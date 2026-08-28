-- ============================================================================
-- MIGRATION NETTOYÉE : ENREGISTREMENT EXCLUSIF DE LA LOCALISATION DANS 
-- LIQUIDATIONS & TPS_LIQUIDATIONS (SANS DÉPENDRE DE CONTRIBUABLES)
-- ============================================================================

-- 1. AJOUT DES COLONNES DE LOCALISATION SI ELLES N'EXISTENT PAS DÉJÀ
ALTER TABLE public.liquidations
  ADD COLUMN IF NOT EXISTS commune TEXT,
  ADD COLUMN IF NOT EXISTS arrondissement TEXT,
  ADD COLUMN IF NOT EXISTS quartier TEXT;

ALTER TABLE public.tps_liquidations
  ADD COLUMN IF NOT EXISTS commune TEXT,
  ADD COLUMN IF NOT EXISTS arrondissement TEXT,
  ADD COLUMN IF NOT EXISTS quartier TEXT;


-- 2. MIGRATION ET BACKFILL DES DONNÉES EXISTANTES (POUR LES ANCIENNES LIQUIDATIONS NULL)
UPDATE public.liquidations l
SET 
  commune = c.commune,
  arrondissement = c.arrondissement,
  quartier = c.quartier
FROM public.contribuables c
WHERE l.contribuable_id = c.id AND l.commune IS NULL;

UPDATE public.tps_liquidations tl
SET 
  commune = tc.commune,
  arrondissement = tc.arrondissement,
  quartier = tc.quartier
FROM public.tps_contribuables tc
WHERE tl.contribuable_id = tc.id AND tl.commune IS NULL;


-- 3. CRÉATION LIQUIDATION TFU (PROPRÉMENT DANS LIQUIDATIONS)
CREATE OR REPLACE FUNCTION public.creer_liquidation(
  p_nom_prenoms        TEXT,
  p_ifu_npi            TEXT,
  p_telephone          TEXT,
  p_commune            TEXT,
  p_arrondissement     TEXT,
  p_quartier           TEXT,
  p_superficie         NUMERIC,
  p_valeur_locative    NUMERIC,
  p_start_year         INTEGER DEFAULT 2023,
  p_type_bien          TEXT    DEFAULT 'NON_BATI',
  p_superficie_imposable NUMERIC DEFAULT NULL,
  p_is_loue            BOOLEAN DEFAULT FALSE,
  p_valeur_irf         NUMERIC DEFAULT NULL,
  p_description        TEXT    DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_contrib_id           UUID;
  v_liq_id               UUID;
  v_ref_liq              TEXT;
  v_base                 NUMERIC;
  v_current_year         INTEGER;
  v_next_number          INTEGER;
  v_superficie_imposable NUMERIC;
  v_type_bien            TEXT;
BEGIN
  LOCK TABLE public.liquidations IN EXCLUSIVE MODE;

  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_superficie_imposable := NULLIF(p_superficie_imposable, 0);
  v_type_bien := CASE WHEN UPPER(COALESCE(p_type_bien, 'NON_BATI')) = 'BATI' THEN 'BATI' ELSE 'NON_BATI' END;

  IF v_superficie_imposable IS NOT NULL THEN
    IF v_superficie_imposable >= p_superficie THEN
      RAISE EXCEPTION 'La superficie imposable doit etre inferieure a la superficie totale.';
    END IF;

    IF NOT public.can_apply_exoneration() THEN
      RAISE EXCEPTION 'Seuls les inspecteurs et administrateurs peuvent appliquer une exoneration.';
    END IF;
  END IF;

  -- Le contribuable ne conserve QUE son identité personnelle (Nom, IFU, Tél)
  INSERT INTO public.contribuables (nom_prenoms, ifu_npi, telephone)
  VALUES (p_nom_prenoms, p_ifu_npi, p_telephone)
  ON CONFLICT (ifu_npi) DO UPDATE SET
    nom_prenoms = EXCLUDED.nom_prenoms,
    telephone   = EXCLUDED.telephone
  RETURNING id INTO v_contrib_id;

  IF v_type_bien = 'BATI' THEN
    v_base := COALESCE(p_valeur_locative, 0);
  ELSE
    v_base := (COALESCE(v_superficie_imposable, p_superficie) * COALESCE(p_valeur_locative, 0));
  END IF;

  SELECT COALESCE(
    MAX(CAST(substring(reference_liq FROM 'LIQ-' || v_current_year || '-([0-9]+)$') AS INTEGER)),
    0
  ) + 1 INTO v_next_number
  FROM public.liquidations
  WHERE reference_liq LIKE 'LIQ-' || v_current_year || '-%';

  v_ref_liq := 'LIQ-' || v_current_year || '-' || LPAD(v_next_number::text, 5, '0');

  -- La localisation est enregistrée EXCLUSIVEMENT dans la table LIQUIDATIONS
  INSERT INTO public.liquidations (
    reference_liq, contribuable_id, superficie, superficie_imposable,
    valeur_locative, start_year, type_bien, base_imposable, status,
    is_loue, valeur_irf, description,
    commune, arrondissement, quartier
  ) VALUES (
    v_ref_liq, v_contrib_id,
    COALESCE(p_superficie, 0),
    v_superficie_imposable,
    COALESCE(p_valeur_locative, 0),
    COALESCE(p_start_year, 2023),
    v_type_bien,
    v_base,
    'EN_ATTENTE',
    COALESCE(p_is_loue, FALSE),
    NULLIF(p_valeur_irf, 0),
    NULLIF(p_description, ''),
    UPPER(p_commune),
    UPPER(p_arrondissement),
    UPPER(p_quartier)
  )
  RETURNING id INTO v_liq_id;

  RETURN jsonb_build_object(
    'liquidation_id', v_liq_id,
    'reference_liq', v_ref_liq,
    'contribuable_id', v_contrib_id,
    'commune', UPPER(p_commune),
    'status', 'EN_ATTENTE'
  );
END;
$$ LANGUAGE plpgsql;


-- 4. CRÉATION LIQUIDATION TPS (PROPRÉMENT DANS TPS_LIQUIDATIONS)
CREATE OR REPLACE FUNCTION public.creer_liquidation_tps(
  p_nom_raison_sociale TEXT,
  p_ifu_nc TEXT,
  p_telephone TEXT,
  p_commune TEXT,
  p_arrondissement TEXT,
  p_quartier TEXT,
  p_localisation TEXT,
  p_activite TEXT,
  p_montant_autres_activites NUMERIC,
  p_acomptes_payes NUMERIC,
  p_start_year INTEGER DEFAULT 2024
) RETURNS JSONB AS $$
DECLARE
  v_contrib_id UUID;
  v_liq_id UUID;
  v_ref_tps TEXT;
  v_tps NUMERIC;
  v_impot_du NUMERIC;
  v_reste_du NUMERIC;
  v_count INTEGER;
BEGIN
  -- Le contribuable TPS ne conserve QUE son identité (Nom/Raison Sociale, IFU, Tél)
  INSERT INTO public.tps_contribuables (nom_raison_sociale, ifu_nc, telephone)
  VALUES (p_nom_raison_sociale, p_ifu_nc, p_telephone)
  ON CONFLICT (ifu_nc) DO UPDATE SET
    nom_raison_sociale = EXCLUDED.nom_raison_sociale,
    telephone          = EXCLUDED.telephone
  RETURNING id INTO v_contrib_id;

  SELECT COUNT(*) + 1 INTO v_count FROM public.tps_liquidations;
  v_ref_tps := 'TPS-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(v_count::text, 5, '0');

  v_tps := ROUND(p_montant_autres_activites * 0.05);
  v_impot_du := v_tps + 4000;
  v_reste_du := v_impot_du - COALESCE(p_acomptes_payes, 0);

  -- La localisation est enregistrée EXCLUSIVEMENT dans TPS_LIQUIDATIONS
  INSERT INTO public.tps_liquidations (
    reference_tps,
    contribuable_id,
    activite,
    montant_autres_activites,
    tps_calcule,
    portb,
    impot_du,
    acomptes_payes,
    reste_du,
    start_year,
    status,
    commune,
    arrondissement,
    quartier
  ) VALUES (
    v_ref_tps,
    v_contrib_id,
    p_activite,
    p_montant_autres_activites,
    v_tps,
    4000,
    v_impot_du,
    COALESCE(p_acomptes_payes, 0),
    v_reste_du,
    COALESCE(p_start_year, 2024),
    'EN_ATTENTE',
    UPPER(p_commune),
    UPPER(p_arrondissement),
    UPPER(p_quartier)
  )
  RETURNING id INTO v_liq_id;

  RETURN jsonb_build_object(
    'tps_id', v_liq_id,
    'reference_tps', v_ref_tps,
    'contribuable_id', v_contrib_id,
    'commune', UPPER(p_commune),
    'status', 'EN_ATTENTE'
  );
END;
$$ LANGUAGE plpgsql;


-- 5. VALIDATION PAIEMENT TFU (UTILISE LA LOCALISATION DE LA LIQUIDATION)
CREATE OR REPLACE FUNCTION public.valider_paiement_liquidation(
  p_liquidation_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_liq                    RECORD;
  v_contrib                RECORD;
  v_role_id                UUID;
  v_role_num               INTEGER;
  v_current_year           INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_last_article_num       INTEGER := 0;
  v_exercise_year          INTEGER;
  v_base                   NUMERIC;
  v_taux                   NUMERIC;
  v_droit                  NUMERIC;
  v_nature_impot           TEXT;
  v_type_bien              TEXT;
  v_commune                TEXT;
  v_arrondissement         TEXT;
  v_quartier               TEXT;
  v_location_str           TEXT;
  v_desc                   TEXT;
  i                        INTEGER;
  v_articles_requis        INTEGER;
  
  v_active_role_id         UUID;
  v_active_role_num        INTEGER;
  v_active_recouvrement_id UUID := NULL;
  v_first_article_num      INTEGER := NULL;
  v_last_inserted_art      INTEGER := NULL;
BEGIN
  SELECT * INTO v_liq FROM public.liquidations WHERE id = p_liquidation_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation introuvable';
  END IF;

  IF v_liq.status = 'PAYE' THEN
    RAISE EXCEPTION 'Cette liquidation a deja ete payee et validee.';
  END IF;

  SELECT * INTO v_contrib FROM public.contribuables WHERE id = v_liq.contribuable_id;

  -- Déterminer la commune/arrondissement/quartier de la liquidation (priorité à liquidations)
  v_commune        := COALESCE(v_liq.commune, v_contrib.commune);
  v_arrondissement := COALESCE(v_liq.arrondissement, v_contrib.arrondissement);
  v_quartier       := COALESCE(v_liq.quartier, v_contrib.quartier);

  -- Récupérer ou créer le rôle communal correspondant
  SELECT id, numero_role INTO v_role_id, v_role_num
  FROM public.roles
  WHERE commune = v_commune
    AND annee = v_current_year
    AND status = 'ACTIF'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.roles (commune, annee, numero_role, status)
    VALUES (v_commune, v_current_year, 1, 'ACTIF')
    RETURNING id, numero_role INTO v_role_id, v_role_num;
  END IF;

  SELECT COALESCE(MAX(ar.numero_article), 0) INTO v_last_article_num
  FROM public.articles_recouvrement ar
  JOIN public.recouvrements r ON ar.recouvrement_id = r.id
  WHERE r.role_id = v_role_id;

  IF v_last_article_num >= 100 THEN
    RAISE EXCEPTION 'Le role % (commune: %) a deja atteint la limite de 100 articles. Veuillez le cloturer avant de valider.',
      v_role_num, v_commune;
  END IF;

  v_type_bien := CASE
    WHEN UPPER(COALESCE(v_liq.type_bien, 'NON_BATI')) = 'BATI' THEN 'BATI'
    ELSE 'NON_BATI'
  END;

  IF v_type_bien = 'NON_BATI' THEN
    v_articles_requis := 4;
  ELSIF v_liq.is_loue THEN
    v_articles_requis := 3;
  ELSE
    v_articles_requis := 1;
  END IF;

  UPDATE public.liquidations
  SET status       = 'PAYE',
      validated_by = auth.uid(),
      validated_at = now()
  WHERE id = p_liquidation_id;

  v_location_str := UPPER(v_commune || '/' || v_arrondissement || '/' || v_quartier);

  v_active_role_id  := v_role_id;
  v_active_role_num := v_role_num;

  FOR i IN 0..(v_articles_requis - 1) LOOP
    IF v_last_article_num = 100 THEN
      UPDATE public.roles SET status = 'CLOTURE' WHERE id = v_active_role_id;
      
      INSERT INTO public.roles (commune, annee, numero_role, status)
      VALUES (v_commune, v_current_year, v_active_role_num + 1, 'ACTIF')
      RETURNING id, numero_role INTO v_active_role_id, v_active_role_num;
      
      v_last_article_num := 0;
      v_active_recouvrement_id := NULL;
    END IF;

    IF v_active_recouvrement_id IS NULL THEN
      INSERT INTO public.recouvrements (liquidation_id, role_id, contribuable_id)
      VALUES (p_liquidation_id, v_active_role_id, v_contrib.id)
      RETURNING id INTO v_active_recouvrement_id;
    END IF;

    IF v_type_bien = 'NON_BATI' THEN
      v_base := COALESCE(v_liq.superficie_imposable, v_liq.superficie) * v_liq.valeur_locative;
      IF v_liq.superficie_imposable IS NOT NULL
         AND v_liq.superficie_imposable > 0
         AND v_liq.superficie_imposable < v_liq.superficie THEN
        v_desc := 'PARCELLE DE ' || v_liq.superficie || ' M2 SISE A ' || v_location_str || ' AVEC EXONERATION PARTIELLE';
      ELSE
        v_desc := 'PARCELLE DE ' || v_liq.superficie || ' M2 SISE A ' || v_location_str;
      END IF;
      
      v_exercise_year := v_liq.start_year + i;
      IF v_exercise_year = 2023 THEN
        v_nature_impot := 'TFU/FNB';
        v_taux := 0.04;
      ELSE
        v_nature_impot := 'TFU/FNB';
        v_taux := 0.05;
      END IF;
      v_droit := v_base * v_taux;
      
    ELSIF v_type_bien = 'BATI' AND NOT COALESCE(v_liq.is_loue, FALSE) THEN
      v_exercise_year := v_liq.start_year;
      v_base          := v_liq.valeur_locative;
      v_taux          := 0.06;
      v_droit         := v_base * v_taux;
      v_desc          := COALESCE(NULLIF(v_liq.description, ''), 'PROPRIETE SISE A ' || v_location_str);
      v_nature_impot  := 'TFU/FB';
      
    ELSE
      IF i = 0 THEN
        v_exercise_year := v_liq.start_year - 1;
        v_base          := COALESCE(v_liq.valeur_irf, 0);
        v_taux          := 0.12;
        v_droit         := v_base * v_taux;
        v_desc          := 'MICRO FONCIER - ' || v_location_str;
        v_nature_impot  := 'IRF';
      ELSIF i = 1 THEN
        v_exercise_year := v_liq.start_year;
        v_base          := 0;
        v_taux          := 0;
        v_droit         := 4000;
        v_desc          := 'PRELEVEMENT ORTB - ' || v_location_str;
        v_nature_impot  := 'P-ORTB';
      ELSE
        v_exercise_year := v_liq.start_year;
        v_base          := v_liq.valeur_locative;
        v_taux          := 0.06;
        v_droit         := v_base * v_taux;
        v_desc          := COALESCE(NULLIF(v_liq.description, ''), 'PROPRIETE SISE A ' || v_location_str);
        v_nature_impot  := 'TFU/FB';
      END IF;
    END IF;

    v_last_article_num := v_last_article_num + 1;
    INSERT INTO public.articles_recouvrement (
      recouvrement_id, numero_article, exercice, nature_impot,
      localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
    ) VALUES (
      v_active_recouvrement_id, v_last_article_num, v_exercise_year, v_nature_impot,
      v_location_str, v_desc, v_base, v_taux, v_droit, 0, 0, v_droit
    );

    IF v_first_article_num IS NULL THEN
      v_first_article_num := v_last_article_num;
    END IF;
    v_last_inserted_art := v_last_article_num;
  END LOOP;

  RETURN jsonb_build_object(
    'recouvrement_id',   v_active_recouvrement_id,
    'role_id',           v_active_role_id,
    'numero_role',       v_active_role_num,
    'commune',           v_commune,
    'annee',             v_current_year,
    'first_article_num', v_first_article_num,
    'last_article_num',  v_last_inserted_art
  );
END;
$$ LANGUAGE plpgsql;


-- 6. VALIDATION PAIEMENT TPS (UTILISE LA LOCALISATION DE LA LIQUIDATION TPS)
CREATE OR REPLACE FUNCTION public.valider_paiement_tps(
  p_liquidation_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_liq                    RECORD;
  v_contrib                RECORD;
  v_role_id                UUID;
  v_role_num               INTEGER;
  v_current_year           INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_last_article_num       INTEGER := 0;
  v_commune                TEXT;
  i                        INTEGER;
  
  v_active_role_id         UUID;
  v_active_role_num        INTEGER;
  v_first_article_num      INTEGER := NULL;
  v_last_inserted_art      INTEGER := NULL;
BEGIN
  SELECT * INTO v_liq FROM public.tps_liquidations WHERE id = p_liquidation_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation TPS introuvable';
  END IF;

  IF v_liq.status = 'VALIDE' THEN
    RAISE EXCEPTION 'Cet avis TPS a deja ete valide.';
  END IF;

  SELECT * INTO v_contrib FROM public.tps_contribuables WHERE id = v_liq.contribuable_id;

  v_commune := COALESCE(v_liq.commune, v_contrib.commune);

  SELECT id, numero_role INTO v_role_id, v_role_num
  FROM public.tps_roles
  WHERE commune = v_commune AND annee = v_current_year AND status = 'ACTIF'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.tps_roles (commune, annee, numero_role, status)
    VALUES (v_commune, v_current_year, 1, 'ACTIF')
    RETURNING id, numero_role INTO v_role_id, v_role_num;
  END IF;

  SELECT COALESCE(MAX(ta.numero_article), 0) INTO v_last_article_num
  FROM public.tps_articles ta
  WHERE ta.role_id = v_role_id;

  IF v_last_article_num >= 100 THEN
    RAISE EXCEPTION 'Le role TPS actuel pour % a deja atteint la limite de 100 articles. Veuillez le cloturer avant de valider.',
      v_commune;
  END IF;

  UPDATE public.tps_liquidations 
  SET 
    status = 'VALIDE',
    validated_by = auth.uid(),
    validated_at = now()
  WHERE id = p_liquidation_id;

  v_active_role_id  := v_role_id;
  v_active_role_num := v_role_num;

  FOR i IN 0..1 LOOP
    IF v_last_article_num = 100 THEN
      UPDATE public.tps_roles SET status = 'CLOTURE' WHERE id = v_active_role_id;
      
      INSERT INTO public.tps_roles (commune, annee, numero_role, status)
      VALUES (v_commune, v_current_year, v_active_role_num + 1, 'ACTIF')
      RETURNING id, numero_role INTO v_active_role_id, v_active_role_num;
      
      v_last_article_num := 0;
    END IF;

    v_last_article_num := v_last_article_num + 1;
    INSERT INTO public.tps_articles (
      liquidation_id, role_id, numero_article, exercice, annee_mise_recouvrement
    ) VALUES (
      p_liquidation_id, v_active_role_id, v_last_article_num, v_liq.start_year + i, v_current_year
    );

    IF v_first_article_num IS NULL THEN
      v_first_article_num := v_last_article_num;
    END IF;
    v_last_inserted_art := v_last_article_num;
  END LOOP;

  RETURN jsonb_build_object(
    'role_id',           v_active_role_id,
    'numero_role',       v_active_role_num,
    'commune',           v_commune,
    'first_article_num', v_first_article_num,
    'last_article_num',  v_last_inserted_art
  );
END;
$$ LANGUAGE plpgsql;
