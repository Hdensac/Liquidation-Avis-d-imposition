-- ============================================================================
-- MIGRATION : SÉLECTION FLEXIBLE DES EXERCICES FNB (SELECTED_YEARS)
-- Date    : 2026-09-20
-- Auteur  : Antigravity
-- ============================================================================

-- 1. COLONNE SELECTED_YEARS
-------------------------------------------------------------------------------
ALTER TABLE public.liquidations
  ADD COLUMN IF NOT EXISTS selected_years INTEGER[] DEFAULT NULL;

-- 2. MISE À JOUR DE CREER_LIQUIDATION
-------------------------------------------------------------------------------
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
  p_description        TEXT    DEFAULT NULL,
  -- NOUVEAU PARAMÈTRE : EXERCICES SELECTIONNES POUR FNB
  p_selected_years     INTEGER[] DEFAULT NULL
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

  -- Vérification des droits si une sélection spécifique d'exercices FNB est soumise
  IF p_selected_years IS NOT NULL AND array_length(p_selected_years, 1) > 0 THEN
    IF array_length(p_selected_years, 1) <> 4 AND NOT public.can_apply_exoneration() THEN
      RAISE EXCEPTION 'Seuls les inspecteurs et administrateurs peuvent exclure des exercices FNB.';
    END IF;
  END IF;

  INSERT INTO public.contribuables (nom_prenoms, ifu_npi, telephone, commune, arrondissement, quartier)
  VALUES (p_nom_prenoms, p_ifu_npi, p_telephone, UPPER(p_commune), UPPER(p_arrondissement), UPPER(p_quartier))
  ON CONFLICT (ifu_npi) DO UPDATE SET
    nom_prenoms    = EXCLUDED.nom_prenoms,
    telephone      = EXCLUDED.telephone,
    commune        = EXCLUDED.commune,
    arrondissement = EXCLUDED.arrondissement,
    quartier       = EXCLUDED.quartier
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

  INSERT INTO public.liquidations (
    reference_liq, contribuable_id, superficie, superficie_imposable,
    valeur_locative, start_year, type_bien, base_imposable, status,
    is_loue, valeur_irf, description, selected_years
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
    p_selected_years
  )
  RETURNING id INTO v_liq_id;

  RETURN jsonb_build_object(
    'liquidation_id', v_liq_id,
    'reference_liq',  v_ref_liq,
    'contribuable_id', v_contrib_id,
    'type_bien',      v_type_bien,
    'status',         'EN_ATTENTE'
  );
END;
$$ LANGUAGE plpgsql;

-- 3. MISE À JOUR DE VALIDER_PAIEMENT_LIQUIDATION
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valider_paiement_liquidation(
  p_liquidation_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_liq              RECORD;
  v_contrib          RECORD;
  v_role_id          UUID;
  v_role_num         INTEGER;
  v_current_year     INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_recouvrement_id  UUID;
  v_last_article_num INTEGER := 0;
  v_exercise_year    INTEGER;
  v_base             NUMERIC;
  v_taux             NUMERIC;
  v_droit            NUMERIC;
  v_nature_impot     TEXT;
  v_type_bien        TEXT;
  v_location_str     TEXT;
  v_desc             TEXT;
  i                  INTEGER;
  v_articles_requis  INTEGER;
BEGIN
  -- Récupération et verrouillage de la liquidation
  SELECT * INTO v_liq FROM public.liquidations WHERE id = p_liquidation_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation introuvable';
  END IF;

  IF v_liq.status = 'PAYE' THEN
    RAISE EXCEPTION 'Cette liquidation a deja ete payee et validee.';
  END IF;

  SELECT * INTO v_contrib FROM public.contribuables WHERE id = v_liq.contribuable_id;

  -- Récupération ou création du rôle actif (verrouillé FOR UPDATE)
  SELECT id, numero_role INTO v_role_id, v_role_num
  FROM public.roles
  WHERE commune = v_contrib.commune
    AND annee = v_current_year
    AND status = 'ACTIF'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.roles (commune, annee, numero_role, status)
    VALUES (v_contrib.commune, v_current_year, 1, 'ACTIF')
    RETURNING id, numero_role INTO v_role_id, v_role_num;
  END IF;

  -- Dernier numéro d'article dans ce rôle
  SELECT COALESCE(MAX(ar.numero_article), 0) INTO v_last_article_num
  FROM public.articles_recouvrement ar
  JOIN public.recouvrements r ON ar.recouvrement_id = r.id
  WHERE r.role_id = v_role_id;

  -- Calcul du nombre d'articles requis pour cette liquidation
  v_type_bien := CASE
    WHEN UPPER(COALESCE(v_liq.type_bien, 'NON_BATI')) = 'BATI' THEN 'BATI'
    ELSE 'NON_BATI'
  END;

  IF v_type_bien = 'NON_BATI' THEN
    IF v_liq.selected_years IS NOT NULL AND array_length(v_liq.selected_years, 1) > 0 THEN
      v_articles_requis := array_length(v_liq.selected_years, 1);
    ELSE
      v_articles_requis := 4;
    END IF;
  ELSIF v_liq.is_loue THEN
    v_articles_requis := 3;
  ELSE
    v_articles_requis := 1;
  END IF;

  -- Vérification de la limite de 100 articles par rôle
  IF (v_last_article_num + v_articles_requis) > 100 THEN
    RAISE EXCEPTION 'Limite atteinte : le role % (commune: %) contient % articles. Une validation % article(s) depasserait 100. Cloturez ce role.',
      v_role_num, v_contrib.commune, v_last_article_num, v_articles_requis;
  END IF;

  -- Création du recouvrement
  INSERT INTO public.recouvrements (liquidation_id, role_id, contribuable_id)
  VALUES (p_liquidation_id, v_role_id, v_contrib.id)
  RETURNING id INTO v_recouvrement_id;

  -- Passage en statut PAYE
  UPDATE public.liquidations
  SET status       = 'PAYE',
      validated_by = auth.uid(),
      validated_at = now()
  WHERE id = p_liquidation_id;

  -- Localisation commune
  v_location_str := UPPER(v_contrib.commune || '/' || v_contrib.arrondissement || '/' || v_contrib.quartier);

  -- CAS 1 : FONCIER NON BÂTI (NON_BATI)
  IF v_type_bien = 'NON_BATI' THEN
    v_base := COALESCE(v_liq.superficie_imposable, v_liq.superficie) * v_liq.valeur_locative;

    IF v_liq.superficie_imposable IS NOT NULL
       AND v_liq.superficie_imposable > 0
       AND v_liq.superficie_imposable < v_liq.superficie THEN
      v_desc := 'PARCELLE DE ' || v_liq.superficie || ' M2 SISE A ' || v_location_str || ' AVEC EXONERATION PARTIELLE';
    ELSE
      v_desc := 'PARCELLE DE ' || v_liq.superficie || ' M2 SISE A ' || v_location_str;
    END IF;

    IF v_liq.selected_years IS NOT NULL AND array_length(v_liq.selected_years, 1) > 0 THEN
      FOREACH v_exercise_year IN ARRAY v_liq.selected_years LOOP
        IF v_exercise_year = 2023 THEN
          v_nature_impot := 'TFU/FNB';
          v_taux := 0.04;
        ELSE
          v_nature_impot := 'TFU/FNB';
          v_taux := 0.05;
        END IF;

        v_droit := v_base * v_taux;
        v_last_article_num := v_last_article_num + 1;

        INSERT INTO public.articles_recouvrement (
          recouvrement_id, numero_article, exercice, nature_impot,
          localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
        ) VALUES (
          v_recouvrement_id, v_last_article_num, v_exercise_year, v_nature_impot,
          v_location_str, v_desc, v_base, v_taux, v_droit, 0, 0, v_droit
        );
      END LOOP;
    ELSE
      FOR i IN 0..3 LOOP
        v_exercise_year := v_liq.start_year + i;

        IF v_exercise_year = 2023 THEN
          v_nature_impot := 'TFU/FNB';
          v_taux := 0.04;
        ELSE
          v_nature_impot := 'TFU/FNB';
          v_taux := 0.05;
        END IF;

        v_droit := v_base * v_taux;
        v_last_article_num := v_last_article_num + 1;

        INSERT INTO public.articles_recouvrement (
          recouvrement_id, numero_article, exercice, nature_impot,
          localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
        ) VALUES (
          v_recouvrement_id, v_last_article_num, v_exercise_year, v_nature_impot,
          v_location_str, v_desc, v_base, v_taux, v_droit, 0, 0, v_droit
        );
      END LOOP;
    END IF;

  -- CAS 2 : FONCIER BÂTI (BATI) SANS LOCATION
  ELSIF v_type_bien = 'BATI' AND NOT COALESCE(v_liq.is_loue, FALSE) THEN
    v_exercise_year    := v_liq.start_year;
    v_base             := v_liq.valeur_locative;
    v_taux             := 0.06;
    v_droit            := v_base * v_taux;
    v_last_article_num := v_last_article_num + 1;
    v_desc             := COALESCE(NULLIF(v_liq.description, ''), 'PROPRIETE SISE A ' || v_location_str);

    INSERT INTO public.articles_recouvrement (
      recouvrement_id, numero_article, exercice, nature_impot,
      localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
    ) VALUES (
      v_recouvrement_id, v_last_article_num, v_exercise_year, 'TFU/FB',
      v_location_str, v_desc, v_base, v_taux, v_droit, 0, 0, v_droit
    );

  -- CAS 3 : FONCIER BÂTI (BATI) EN LOCATION
  ELSIF v_type_bien = 'BATI' AND COALESCE(v_liq.is_loue, FALSE) THEN
    v_exercise_year    := v_liq.start_year - 1;
    v_base             := COALESCE(v_liq.valeur_irf, 0);
    v_taux             := 0.12;
    v_droit            := v_base * v_taux;
    v_last_article_num := v_last_article_num + 1;

    INSERT INTO public.articles_recouvrement (
      recouvrement_id, numero_article, exercice, nature_impot,
      localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
    ) VALUES (
      v_recouvrement_id, v_last_article_num, v_exercise_year, 'IRF',
      v_location_str, 'MICRO FONCIER - ' || v_location_str,
      v_base, v_taux, v_droit, 0, 0, v_droit
    );

    v_exercise_year    := v_liq.start_year;
    v_last_article_num := v_last_article_num + 1;

    INSERT INTO public.articles_recouvrement (
      recouvrement_id, numero_article, exercice, nature_impot,
      localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
    ) VALUES (
      v_recouvrement_id, v_last_article_num, v_exercise_year, 'P-ORTB',
      v_location_str, 'PRELEVEMENT ORTB - ' || v_location_str,
      0, 0, 4000, 0, 0, 4000
    );

    v_base             := v_liq.valeur_locative;
    v_taux             := 0.06;
    v_droit            := v_base * v_taux;
    v_last_article_num := v_last_article_num + 1;
    v_desc             := COALESCE(NULLIF(v_liq.description, ''), 'PROPRIETE SISE A ' || v_location_str);

    INSERT INTO public.articles_recouvrement (
      recouvrement_id, numero_article, exercice, nature_impot,
      localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
    ) VALUES (
      v_recouvrement_id, v_last_article_num, v_exercise_year, 'TFU/FB',
      v_location_str, v_desc, v_base, v_taux, v_droit, 0, 0, v_droit
    );

  END IF;

  RETURN jsonb_build_object(
    'recouvrement_id',   v_recouvrement_id,
    'role_id',           v_role_id,
    'numero_role',       v_role_num,
    'commune',           v_contrib.commune,
    'annee',             v_current_year,
    'first_article_num', v_last_article_num - v_articles_requis + 1,
    'last_article_num',  v_last_article_num
  );
END;
$$ LANGUAGE plpgsql;
