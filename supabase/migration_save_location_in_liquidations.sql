-- ============================================================================
-- MIGRATION : ENREGISTREMENT DE LA LOCALISATION DANS LIQUIDATIONS & TPS_LIQUIDATIONS
-- ============================================================================

-- 1. S'ASSURER QUE LES COLONNES EXISTENT DANS LIQUIDATIONS ET TPS_LIQUIDATIONS
ALTER TABLE public.liquidations
  ADD COLUMN IF NOT EXISTS commune TEXT,
  ADD COLUMN IF NOT EXISTS arrondissement TEXT,
  ADD COLUMN IF NOT EXISTS quartier TEXT;

ALTER TABLE public.tps_liquidations
  ADD COLUMN IF NOT EXISTS commune TEXT,
  ADD COLUMN IF NOT EXISTS arrondissement TEXT,
  ADD COLUMN IF NOT EXISTS quartier TEXT;


-- 2. MISE À JOUR DE LA FONCTION CREER_LIQUIDATION (TFU)
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

  -- Insérer ou récupérer le contribuable (l'identité) sans écraser sa commune s'il existe déjà
  INSERT INTO public.contribuables (nom_prenoms, ifu_npi, telephone, commune, arrondissement, quartier)
  VALUES (p_nom_prenoms, p_ifu_npi, p_telephone, UPPER(p_commune), UPPER(p_arrondissement), UPPER(p_quartier))
  ON CONFLICT (ifu_npi) DO UPDATE SET
    nom_prenoms    = EXCLUDED.nom_prenoms,
    telephone      = EXCLUDED.telephone
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

  -- Enregistrer la localisation directement dans la table LIQUIDATIONS
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


-- 3. MISE À JOUR DE LA FONCTION CREER_LIQUIDATION_TPS (TPS)
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
  -- Insérer ou mettre à jour l'identité du contribuable TPS
  INSERT INTO public.tps_contribuables (nom_raison_sociale, ifu_nc, telephone, commune, arrondissement, quartier, localisation)
  VALUES (p_nom_raison_sociale, p_ifu_nc, p_telephone, UPPER(p_commune), UPPER(p_arrondissement), UPPER(p_quartier), p_localisation)
  ON CONFLICT (ifu_nc) DO UPDATE SET
    nom_raison_sociale = EXCLUDED.nom_raison_sociale,
    telephone = EXCLUDED.telephone
  RETURNING id INTO v_contrib_id;

  -- Génération référence unique TPS-YYYY-XXXXX
  SELECT COUNT(*) + 1 INTO v_count FROM public.tps_liquidations;
  v_ref_tps := 'TPS-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(v_count::text, 5, '0');

  v_tps := ROUND(p_montant_autres_activites * 0.05);
  v_impot_du := v_tps + 4000;
  v_reste_du := v_impot_du - COALESCE(p_acomptes_payes, 0);

  -- Enregistrer la localisation directement dans la table TPS_LIQUIDATIONS
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
