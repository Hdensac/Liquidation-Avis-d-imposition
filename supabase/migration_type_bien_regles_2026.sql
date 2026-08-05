-- ============================================================================
-- MIGRATION : TYPE DE BIEN & REGLES FISCALES 2026
-- ============================================================================

ALTER TABLE public.liquidations
  ADD COLUMN IF NOT EXISTS type_bien TEXT NOT NULL DEFAULT 'NON_BATI';

UPDATE public.liquidations
SET type_bien = 'NON_BATI'
WHERE type_bien IS NULL
   OR type_bien NOT IN ('NON_BATI', 'BATI');

ALTER TABLE public.liquidations
  ALTER COLUMN type_bien SET DEFAULT 'NON_BATI',
  ALTER COLUMN type_bien SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'liquidations_type_bien_check'
      AND conrelid = 'public.liquidations'::regclass
  ) THEN
    ALTER TABLE public.liquidations
      ADD CONSTRAINT liquidations_type_bien_check
      CHECK (type_bien IN ('NON_BATI', 'BATI'))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.liquidations
  VALIDATE CONSTRAINT liquidations_type_bien_check;

DROP FUNCTION IF EXISTS public.creer_liquidation(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  INTEGER,
  NUMERIC
);

DROP FUNCTION IF EXISTS public.creer_liquidation(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  INTEGER,
  TEXT,
  NUMERIC
);

CREATE OR REPLACE FUNCTION public.creer_liquidation(
  p_nom_prenoms TEXT,
  p_ifu_npi TEXT,
  p_telephone TEXT,
  p_commune TEXT,
  p_arrondissement TEXT,
  p_quartier TEXT,
  p_superficie NUMERIC,
  p_valeur_locative NUMERIC,
  p_start_year INTEGER DEFAULT 2023,
  p_type_bien TEXT DEFAULT 'NON_BATI',
  p_superficie_imposable NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_contrib_id UUID;
  v_liq_id UUID;
  v_ref_liq TEXT;
  v_base NUMERIC;
  v_count INTEGER;
  v_superficie_imposable NUMERIC;
  v_type_bien TEXT;
BEGIN
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

  INSERT INTO public.contribuables (nom_prenoms, ifu_npi, telephone, commune, arrondissement, quartier)
  VALUES (p_nom_prenoms, p_ifu_npi, p_telephone, UPPER(p_commune), UPPER(p_arrondissement), UPPER(p_quartier))
  ON CONFLICT (ifu_npi) DO UPDATE SET
    nom_prenoms = EXCLUDED.nom_prenoms,
    telephone = EXCLUDED.telephone,
    commune = EXCLUDED.commune,
    arrondissement = EXCLUDED.arrondissement,
    quartier = EXCLUDED.quartier
  RETURNING id INTO v_contrib_id;

  SELECT COUNT(*) + 1 INTO v_count FROM public.liquidations;
  v_ref_liq := 'LIQ-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(v_count::text, 5, '0');
  v_base := COALESCE(v_superficie_imposable, p_superficie) * p_valeur_locative;

  INSERT INTO public.liquidations (
    reference_liq,
    contribuable_id,
    superficie,
    superficie_imposable,
    valeur_locative,
    start_year,
    type_bien,
    base_imposable,
    status
  )
  VALUES (
    v_ref_liq,
    v_contrib_id,
    p_superficie,
    v_superficie_imposable,
    p_valeur_locative,
    p_start_year,
    v_type_bien,
    v_base,
    'EN_ATTENTE'
  )
  RETURNING id INTO v_liq_id;

  RETURN jsonb_build_object(
    'liquidation_id', v_liq_id,
    'reference_liq', v_ref_liq,
    'contribuable_id', v_contrib_id,
    'type_bien', v_type_bien,
    'status', 'EN_ATTENTE'
  );
END;
$$ LANGUAGE plpgsql;

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