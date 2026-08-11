-- ============================================================================
-- SCRIPT DE MIGRATION SUPABASE : SYSTEME D'ADMINISTRATION FISCALE - VOLET TPS
-- Avis de Mise en Recouvrement TPS - République du Bénin
-- ============================================================================

-- 1. TYPES & ENUMS
DO $$ BEGIN
    CREATE TYPE tps_liquidation_status AS ENUM ('EN_ATTENTE', 'VALIDE', 'ANNULE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tps_role_status AS ENUM ('ACTIF', 'CLOTURE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- Table A: tps_contribuables
CREATE TABLE IF NOT EXISTS public.tps_contribuables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_raison_sociale TEXT NOT NULL,
  ifu_nc TEXT UNIQUE NOT NULL,
  telephone TEXT,
  commune TEXT NOT NULL,
  arrondissement TEXT NOT NULL,
  quartier TEXT NOT NULL,
  localisation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table B: tps_roles
CREATE TABLE IF NOT EXISTS public.tps_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune TEXT NOT NULL,
  annee INTEGER NOT NULL,
  numero_role INTEGER NOT NULL DEFAULT 1,
  status tps_role_status NOT NULL DEFAULT 'ACTIF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (commune, annee, numero_role)
);

-- Table C: tps_liquidations
CREATE TABLE IF NOT EXISTS public.tps_liquidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_tps TEXT UNIQUE NOT NULL,
  contribuable_id UUID NOT NULL REFERENCES public.tps_contribuables(id) ON DELETE RESTRICT,
  activite TEXT NOT NULL,
  montant_autres_activites NUMERIC NOT NULL DEFAULT 0,
  tps_calcule NUMERIC NOT NULL DEFAULT 0,
  portb NUMERIC NOT NULL DEFAULT 4000,
  impot_du NUMERIC NOT NULL DEFAULT 0,
  acomptes_payes NUMERIC NOT NULL DEFAULT 0,
  reste_du NUMERIC NOT NULL DEFAULT 0,
  start_year INTEGER NOT NULL DEFAULT 2024,
  status tps_liquidation_status NOT NULL DEFAULT 'EN_ATTENTE',
  created_by UUID REFERENCES auth.users(id),
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table D: tps_articles
CREATE TABLE IF NOT EXISTS public.tps_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_id UUID NOT NULL REFERENCES public.tps_liquidations(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL REFERENCES public.tps_roles(id) ON DELETE RESTRICT,
  numero_article INTEGER NOT NULL,
  exercice INTEGER NOT NULL,
  annee_mise_recouvrement INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, numero_article)
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_tps_contribuables_ifu ON public.tps_contribuables(ifu_nc);
CREATE INDEX IF NOT EXISTS idx_tps_liquidations_status ON public.tps_liquidations(status);
CREATE INDEX IF NOT EXISTS idx_tps_roles_lookup ON public.tps_roles(commune, annee, status);
CREATE INDEX IF NOT EXISTS idx_tps_articles_liq ON public.tps_articles(liquidation_id);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.tps_contribuables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tps_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tps_liquidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tps_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access tps_contribuables" ON public.tps_contribuables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access tps_roles" ON public.tps_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access tps_liquidations" ON public.tps_liquidations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon access tps_articles" ON public.tps_articles FOR ALL USING (true) WITH CHECK (true);

-- 5. PROCEDURES STOCKEES (RPC)

-- A. Créer ou mettre à jour une liquidation TPS
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
  -- Upsert du contribuable TPS
  INSERT INTO public.tps_contribuables (nom_raison_sociale, ifu_nc, telephone, commune, arrondissement, quartier, localisation)
  VALUES (p_nom_raison_sociale, p_ifu_nc, p_telephone, UPPER(p_commune), UPPER(p_arrondissement), UPPER(p_quartier), p_localisation)
  ON CONFLICT (ifu_nc) DO UPDATE SET
    nom_raison_sociale = EXCLUDED.nom_raison_sociale,
    telephone = EXCLUDED.telephone,
    commune = EXCLUDED.commune,
    arrondissement = EXCLUDED.arrondissement,
    quartier = EXCLUDED.quartier,
    localisation = EXCLUDED.localisation
  RETURNING id INTO v_contrib_id;

  -- Génération référence unique TPS-YYYY-XXXXX
  SELECT COUNT(*) + 1 INTO v_count FROM public.tps_liquidations;
  v_ref_tps := 'TPS-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(v_count::text, 5, '0');

  -- Calculs financiers
  v_tps := ROUND(p_montant_autres_activites * 0.05);
  v_impot_du := v_tps + 4000;
  v_reste_du := v_impot_du - COALESCE(p_acomptes_payes, 0);

  -- Création de la liquidation TPS
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
    status
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
    p_start_year,
    'EN_ATTENTE'
  )
  RETURNING id INTO v_liq_id;

  RETURN jsonb_build_object(
    'liquidation_id', v_liq_id,
    'reference_tps', v_ref_tps,
    'status', 'EN_ATTENTE'
  );
END;
$$ LANGUAGE plpgsql;

-- B. Validation du paiement TPS & Attribution de 2 numéros d'articles
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

-- C. Clôture de Rôle Actif TPS
CREATE OR REPLACE FUNCTION public.cloturer_role_tps(
  p_commune TEXT
) RETURNS JSONB AS $$
DECLARE
  v_role_id UUID;
  v_old_num INTEGER;
  v_new_num INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  SELECT id, numero_role INTO v_role_id, v_old_num
  FROM public.tps_roles
  WHERE commune = UPPER(p_commune) AND annee = v_current_year AND status = 'ACTIF'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.tps_roles SET status = 'CLOTURE' WHERE id = v_role_id;
    v_new_num := v_old_num + 1;
  ELSE
    v_new_num := 1;
  END IF;

  INSERT INTO public.tps_roles (commune, annee, numero_role, status)
  VALUES (UPPER(p_commune), v_current_year, v_new_num, 'ACTIF');

  RETURN jsonb_build_object(
    'commune', UPPER(p_commune),
    'annee', v_current_year,
    'nouveau_numero_role', v_new_num
  );
END;
$$ LANGUAGE plpgsql;
