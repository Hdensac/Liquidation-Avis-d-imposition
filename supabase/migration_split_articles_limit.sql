-- ============================================================================
-- MIGRATION : DÉCOUPAGE DYNAMIQUE DES ARTICLES HORS LIMITE 100 PAR RÔLE
-- ============================================================================

-- 1. Suppression de la contrainte unique d'unicité sur recouvrements(liquidation_id)
--    Pour permettre d'avoir un recouvrement par rôle pour une même liquidation.
ALTER TABLE public.recouvrements DROP CONSTRAINT IF EXISTS recouvrements_liquidation_id_key;


-- 2. Mise à jour de la fonction de validation TFU
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
  v_location_str           TEXT;
  v_desc                   TEXT;
  i                        INTEGER;
  v_articles_requis        INTEGER;
  
  -- Variables d'état pour le découpage
  v_active_role_id         UUID;
  v_active_role_num        INTEGER;
  v_active_recouvrement_id UUID := NULL;
  
  -- Résultats d'insertion
  v_first_article_num      INTEGER := NULL;
  v_last_inserted_art      INTEGER := NULL;
BEGIN
  -- ── Récupération et verrouillage de la liquidation ──────────────────────
  SELECT * INTO v_liq FROM public.liquidations WHERE id = p_liquidation_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation introuvable';
  END IF;

  IF v_liq.status = 'PAYE' THEN
    RAISE EXCEPTION 'Cette liquidation a deja ete payee et validee.';
  END IF;

  SELECT * INTO v_contrib FROM public.contribuables WHERE id = v_liq.contribuable_id;

  -- ── Récupération ou création du rôle actif (verrouillé FOR UPDATE) ──────
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

  -- ── Dernier numéro d'article dans ce rôle ───────────────────────────────
  SELECT COALESCE(MAX(ar.numero_article), 0) INTO v_last_article_num
  FROM public.articles_recouvrement ar
  JOIN public.recouvrements r ON ar.recouvrement_id = r.id
  WHERE r.role_id = v_role_id;

  -- ── Règle : Si le rôle est déjà à 100, on bloque (workflow manuel) ──────
  IF v_last_article_num >= 100 THEN
    RAISE EXCEPTION 'Le role % (commune: %) a deja atteint la limite de 100 articles. Veuillez le cloturer avant de valider.',
      v_role_num, v_contrib.commune;
  END IF;

  -- ── Calcul du nombre d'articles requis pour cette liquidation ───────────
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

  -- ── Passage en statut PAYE ───────────────────────────────────────────────
  UPDATE public.liquidations
  SET status       = 'PAYE',
      validated_by = auth.uid(),
      validated_at = now()
  WHERE id = p_liquidation_id;

  -- ── Localisation commune ─────────────────────────────────────────────────
  v_location_str := UPPER(v_contrib.commune || '/' || v_contrib.arrondissement || '/' || v_contrib.quartier);

  -- Variables d'état initiales
  v_active_role_id  := v_role_id;
  v_active_role_num := v_role_num;

  -- ── Génération des articles avec découpage dynamique ──────────────────────
  FOR i IN 0..(v_articles_requis - 1) LOOP
    
    -- 1. Changement de rôle si on a atteint 100 articles dans le rôle actif
    IF v_last_article_num = 100 THEN
      -- Clôturer le rôle actif courant
      UPDATE public.roles SET status = 'CLOTURE' WHERE id = v_active_role_id;
      
      -- Créer le rôle actif suivant
      INSERT INTO public.roles (commune, annee, numero_role, status)
      VALUES (v_contrib.commune, v_current_year, v_active_role_num + 1, 'ACTIF')
      RETURNING id, numero_role INTO v_active_role_id, v_active_role_num;
      
      -- Réinitialiser le compteur d'articles
      v_last_article_num := 0;
      
      -- Invalider le recouvrement actif pour forcer la création d'un nouveau
      v_active_recouvrement_id := NULL;
    END IF;

    -- 2. Création d'un recouvrement pour le rôle actif si inexistant
    IF v_active_recouvrement_id IS NULL THEN
      INSERT INTO public.recouvrements (liquidation_id, role_id, contribuable_id)
      VALUES (p_liquidation_id, v_active_role_id, v_contrib.id)
      RETURNING id INTO v_active_recouvrement_id;
    END IF;

    -- 3. Détermination des caractéristiques de l'article en cours
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
      
    ELSE -- BATI avec location
      IF i = 0 THEN -- IRF
        v_exercise_year := v_liq.start_year - 1;
        v_base          := COALESCE(v_liq.valeur_irf, 0);
        v_taux          := 0.12;
        v_droit         := v_base * v_taux;
        v_desc          := 'MICRO FONCIER - ' || v_location_str;
        v_nature_impot  := 'IRF';
      ELSIF i = 1 THEN -- ORTB
        v_exercise_year := v_liq.start_year;
        v_base          := 0;
        v_taux          := 0;
        v_droit         := 4000;
        v_desc          := 'PRELEVEMENT ORTB - ' || v_location_str;
        v_nature_impot  := 'P-ORTB';
      ELSE -- TFU/FB
        v_exercise_year := v_liq.start_year;
        v_base          := v_liq.valeur_locative;
        v_taux          := 0.06;
        v_droit         := v_base * v_taux;
        v_desc          := COALESCE(NULLIF(v_liq.description, ''), 'PROPRIETE SISE A ' || v_location_str);
        v_nature_impot  := 'TFU/FB';
      END IF;
    END IF;

    -- 4. Insertion de l'article
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
    'commune',           v_contrib.commune,
    'annee',             v_current_year,
    'first_article_num', v_first_article_num,
    'last_article_num',  v_last_inserted_art
  );
END;
$$ LANGUAGE plpgsql;


-- 3. Mise à jour de la fonction de validation TPS
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
  i                        INTEGER;
  
  -- Variables d'état pour le découpage
  v_active_role_id         UUID;
  v_active_role_num        INTEGER;
  v_first_article_num      INTEGER := NULL;
  v_last_inserted_art      INTEGER := NULL;
BEGIN
  -- Verrouillage de la liquidation
  SELECT * INTO v_liq FROM public.tps_liquidations WHERE id = p_liquidation_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation TPS introuvable';
  END IF;

  IF v_liq.status = 'VALIDE' THEN
    RAISE EXCEPTION 'Cet avis TPS a deja ete valide.';
  END IF;

  -- Charger le contribuable
  SELECT * INTO v_contrib FROM public.tps_contribuables WHERE id = v_liq.contribuable_id;

  -- Obtenir ou créer le Rôle TPS ACTIF
  SELECT id, numero_role INTO v_role_id, v_role_num
  FROM public.tps_roles
  WHERE commune = v_contrib.commune AND annee = v_current_year AND status = 'ACTIF'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.tps_roles (commune, annee, numero_role, status)
    VALUES (v_contrib.commune, v_current_year, 1, 'ACTIF')
    RETURNING id, numero_role INTO v_role_id, v_role_num;
  END IF;

  -- Obtenir le dernier numéro d'article du rôle TPS
  SELECT COALESCE(MAX(ta.numero_article), 0) INTO v_last_article_num
  FROM public.tps_articles ta
  WHERE ta.role_id = v_role_id;

  -- ── Règle : Si le rôle est déjà à 100, on bloque ──────────────────────────
  IF v_last_article_num >= 100 THEN
    RAISE EXCEPTION 'Le role TPS actuel pour % a deja atteint la limite de 100 articles. Veuillez le cloturer avant de valider.',
      v_contrib.commune;
  END IF;

  -- Marquer la liquidation comme VALIDE et dater
  UPDATE public.tps_liquidations 
  SET 
    status = 'VALIDE',
    validated_by = auth.uid(),
    validated_at = now()
  WHERE id = p_liquidation_id;

  v_active_role_id  := v_role_id;
  v_active_role_num := v_role_num;

  -- Générer 2 articles consécutifs pour les 2 années d'exercice
  FOR i IN 0..1 LOOP
    
    -- 1. Changement de rôle si on a atteint 100 articles
    IF v_last_article_num = 100 THEN
      UPDATE public.tps_roles SET status = 'CLOTURE' WHERE id = v_active_role_id;
      
      INSERT INTO public.tps_roles (commune, annee, numero_role, status)
      VALUES (v_contrib.commune, v_current_year, v_active_role_num + 1, 'ACTIF')
      RETURNING id, numero_role INTO v_active_role_id, v_active_role_num;
      
      v_last_article_num := 0;
    END IF;

    -- 2. Insertion de l'article
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
    'commune',           v_contrib.commune,
    'first_article_num', v_first_article_num,
    'last_article_num',  v_last_inserted_art
  );
END;
$$ LANGUAGE plpgsql;
