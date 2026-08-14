-- Migration to limit article numbers to a maximum of 100 per role

-- 1. For TFU liquidations
CREATE OR REPLACE FUNCTION public.valider_paiement_liquidation(
  p_liquidation_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_liq RECORD;
  v_contrib RECORD;
  v_role_id UUID;
  v_role_num INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_recouvrement_id UUID;
  v_last_article_num INTEGER := 0;
  v_exercise_year INTEGER;
  v_base NUMERIC;
  v_taux NUMERIC;
  v_droit NUMERIC;
  v_nature_impot TEXT;
  v_type_bien TEXT;
  v_location_str TEXT;
  v_desc TEXT;
  i INTEGER;
BEGIN
  SELECT * INTO v_liq FROM public.liquidations WHERE id = p_liquidation_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation introuvable';
  END IF;

  IF v_liq.status = 'PAYE' THEN
    RAISE EXCEPTION 'Cette liquidation a deja ete payee et validee.';
  END IF;

  SELECT * INTO v_contrib FROM public.contribuables WHERE id = v_liq.contribuable_id;

  SELECT id, numero_role INTO v_role_id, v_role_num
  FROM public.roles
  WHERE commune = v_contrib.commune AND annee = v_current_year AND status = 'ACTIF'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.roles (commune, annee, numero_role, status)
    VALUES (v_contrib.commune, v_current_year, 1, 'ACTIF')
    RETURNING id, numero_role INTO v_role_id, v_role_num;
  END IF;

  SELECT COALESCE(MAX(ar.numero_article), 0) INTO v_last_article_num
  FROM public.articles_recouvrement ar
  JOIN public.recouvrements r ON ar.recouvrement_id = r.id
  WHERE r.role_id = v_role_id;

  -- Block if article limit is reached
  IF v_last_article_num >= 100 THEN
    RAISE EXCEPTION 'Le numéro d''article ne peut pas dépasser 100. Veuillez clôturer le rôle actuel de % et en créer un nouveau.', v_contrib.commune;
  END IF;

  INSERT INTO public.recouvrements (liquidation_id, role_id, contribuable_id)
  VALUES (p_liquidation_id, v_role_id, v_contrib.id)
  RETURNING id INTO v_recouvrement_id;

  UPDATE public.liquidations 
  SET 
    status = 'PAYE',
    validated_by = auth.uid(),
    validated_at = now()
  WHERE id = p_liquidation_id;

  v_base := COALESCE(v_liq.superficie_imposable, v_liq.superficie) * v_liq.valeur_locative;
  v_type_bien := CASE WHEN UPPER(COALESCE(v_liq.type_bien, 'NON_BATI')) = 'BATI' THEN 'BATI' ELSE 'NON_BATI' END;
  v_location_str := UPPER(v_contrib.commune || '/' || v_contrib.arrondissement || '/' || v_contrib.quartier);

  IF v_liq.superficie_imposable IS NOT NULL
     AND v_liq.superficie_imposable > 0
     AND v_liq.superficie_imposable < v_liq.superficie THEN
    v_desc := 'PARCELLE DE ' || v_liq.superficie || ' M2 SISE A ' || v_location_str || ' AVEC EXONERATION PARTIELLE';
  ELSE
    v_desc := 'PARCELLE DE ' || v_liq.superficie || ' M2 SISE A ' || v_location_str;
  END IF;

  FOR i IN 0..3 LOOP
    v_exercise_year := v_liq.start_year + i;

    IF v_exercise_year = 2023 THEN
      v_nature_impot := 'TFU/FNB';
      v_taux := 0.04;
    ELSIF v_exercise_year = 2026 AND v_type_bien = 'BATI' THEN
      v_nature_impot := 'TFU/FB';
      v_taux := 0.07;
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

  RETURN jsonb_build_object(
    'recouvrement_id', v_recouvrement_id,
    'role_id', v_role_id,
    'numero_role', v_role_num,
    'commune', v_contrib.commune,
    'annee', v_current_year,
    'first_article_num', v_last_article_num - 3,
    'last_article_num', v_last_article_num
  );
END;
$$ LANGUAGE plpgsql;


-- 2. For TPS liquidations
CREATE OR REPLACE FUNCTION public.valider_paiement_tps(
  p_liquidation_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_liq RECORD;
  v_contrib RECORD;
  v_role_id UUID;
  v_role_num INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_last_article_num INTEGER := 0;
  i INTEGER;
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

  -- Block if article limit is reached
  IF v_last_article_num >= 100 THEN
    RAISE EXCEPTION 'Le numéro d''article ne peut pas dépasser 100. Veuillez clôturer le rôle TPS actuel de % et en créer un nouveau.', v_contrib.commune;
  END IF;

  -- Marquer la liquidation comme VALIDE et dater
  UPDATE public.tps_liquidations 
  SET 
    status = 'VALIDE',
    validated_by = auth.uid(),
    validated_at = now()
  WHERE id = p_liquidation_id;

  -- Générer 2 articles consécutifs pour les 2 années d'exercice
  FOR i IN 0..1 LOOP
    v_last_article_num := v_last_article_num + 1;

    INSERT INTO public.tps_articles (
      liquidation_id, role_id, numero_article, exercice, annee_mise_recouvrement
    ) VALUES (
      p_liquidation_id, v_role_id, v_last_article_num, v_liq.start_year + i, v_current_year
    );
  END LOOP;

  RETURN jsonb_build_object(
    'role_id', v_role_id,
    'numero_role', v_role_num,
    'commune', v_contrib.commune,
    'first_article_num', v_last_article_num - 1,
    'last_article_num', v_last_article_num
  );
END;
$$ LANGUAGE plpgsql;
