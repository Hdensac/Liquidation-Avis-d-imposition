-- ============================================================================
-- MIGRATION : ROLE INSPECTEUR & VERROU EXONERATION
-- ============================================================================

DO $$
BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'INSPECTEUR';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.liquidations
  ADD COLUMN IF NOT EXISTS superficie_imposable NUMERIC;

CREATE OR REPLACE FUNCTION public.can_apply_exoneration()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT role::text IN ('ADMIN', 'INSPECTEUR')
      FROM public.profiles
      WHERE id = auth.uid()
    ),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.creer_liquidation(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  NUMERIC,
  INTEGER
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
  p_superficie_imposable NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_contrib_id UUID;
  v_liq_id UUID;
  v_ref_liq TEXT;
  v_base NUMERIC;
  v_current_year INTEGER;
  v_next_number INTEGER;
  v_superficie_imposable NUMERIC;
BEGIN
  LOCK TABLE public.liquidations IN EXCLUSIVE MODE;

  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  v_superficie_imposable := NULLIF(p_superficie_imposable, 0);

  IF v_superficie_imposable IS NOT NULL THEN
    IF v_superficie_imposable >= p_superficie THEN
      RAISE EXCEPTION 'La superficie imposable doit être inférieure à la superficie totale.';
    END IF;

    IF NOT public.can_apply_exoneration() THEN
      RAISE EXCEPTION 'Seuls les inspecteurs et administrateurs peuvent appliquer une exonération.';
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

  SELECT COALESCE(
    MAX(CAST(substring(reference_liq FROM 'LIQ-' || v_current_year || '-([0-9]+)$') AS INTEGER)),
    0
  ) + 1 INTO v_next_number
  FROM public.liquidations
  WHERE reference_liq LIKE 'LIQ-' || v_current_year || '-%';

  v_ref_liq := 'LIQ-' || v_current_year || '-' || LPAD(v_next_number::text, 5, '0');
  v_base := COALESCE(v_superficie_imposable, p_superficie) * p_valeur_locative;

  INSERT INTO public.liquidations (
    reference_liq,
    contribuable_id,
    superficie,
    superficie_imposable,
    valeur_locative,
    start_year,
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
    v_base,
    'EN_ATTENTE'
  )
  RETURNING id INTO v_liq_id;

  RETURN jsonb_build_object(
    'liquidation_id', v_liq_id,
    'reference_liq', v_ref_liq,
    'contribuable_id', v_contrib_id,
    'status', 'EN_ATTENTE'
  );
END;
$$ LANGUAGE plpgsql;
