-- ============================================================================
-- SCRIPT DE MIGRATION SUPABASE : SYSTEME D'ADMINISTRATION FISCALE D'ETAT
-- Avis de Mise en Recouvrement (TFU / FNB) - République du Bénin
-- ============================================================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE liquidation_status AS ENUM ('EN_ATTENTE', 'PAYE', 'ANNULE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE role_status AS ENUM ('ACTIF', 'CLOTURE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- Table 1: roles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commune TEXT NOT NULL,
  annee INTEGER NOT NULL,
  numero_role INTEGER NOT NULL DEFAULT 1,
  status role_status NOT NULL DEFAULT 'ACTIF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: contribuables
CREATE TABLE IF NOT EXISTS public.contribuables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_prenoms TEXT NOT NULL,
  ifu_npi TEXT UNIQUE NOT NULL,
  telephone TEXT,
  commune TEXT,
  arrondissement TEXT,
  quartier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 3: liquidations (Fiches initiales en attente de paiement)
CREATE TABLE IF NOT EXISTS public.liquidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_liq TEXT UNIQUE NOT NULL,
  contribuable_id UUID NOT NULL REFERENCES public.contribuables(id) ON DELETE CASCADE,
  superficie NUMERIC NOT NULL,
  valeur_locative NUMERIC NOT NULL,
  start_year INTEGER NOT NULL DEFAULT 2023,
  base_imposable NUMERIC NOT NULL,
  status liquidation_status NOT NULL DEFAULT 'EN_ATTENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 4: recouvrements (Paiements validés)
CREATE TABLE IF NOT EXISTS public.recouvrements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_id UUID UNIQUE NOT NULL REFERENCES public.liquidations(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  contribuable_id UUID NOT NULL REFERENCES public.contribuables(id) ON DELETE RESTRICT,
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 5: articles_recouvrement (Lignes d'exercice numérotées)
CREATE TABLE IF NOT EXISTS public.articles_recouvrement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recouvrement_id UUID NOT NULL REFERENCES public.recouvrements(id) ON DELETE CASCADE,
  numero_article INTEGER NOT NULL,
  exercice INTEGER NOT NULL,
  nature_impot TEXT NOT NULL DEFAULT 'TFU/FNB',
  localisation TEXT NOT NULL,
  description TEXT NOT NULL,
  base NUMERIC NOT NULL,
  taux NUMERIC NOT NULL,
  droit_simple NUMERIC NOT NULL,
  penalite NUMERIC NOT NULL DEFAULT 0,
  acompte_paye NUMERIC NOT NULL DEFAULT 0,
  reste_du NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_roles_commune_annee_status ON public.roles(commune, annee, status);
CREATE INDEX IF NOT EXISTS idx_liquidations_status ON public.liquidations(status);
CREATE INDEX IF NOT EXISTS idx_contribuables_ifu ON public.contribuables(ifu_npi);
CREATE INDEX IF NOT EXISTS idx_articles_recouvrement_recouvrement ON public.articles_recouvrement(recouvrement_id);

-- 4. ROW LEVEL SECURITY (RLS) - Permettre la lecture/écriture publique (Anon Key)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribuables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recouvrements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles_recouvrement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read/write roles" ON public.roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write contribuables" ON public.contribuables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write liquidations" ON public.liquidations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write recouvrements" ON public.recouvrements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon read/write articles" ON public.articles_recouvrement FOR ALL USING (true) WITH CHECK (true);

-- 5. PROCEDURES STOCKEES (RPC)

-- A. Création d'une Liquidation en Attente
CREATE OR REPLACE FUNCTION public.creer_liquidation(
  p_nom_prenoms TEXT,
  p_ifu_npi TEXT,
  p_telephone TEXT,
  p_commune TEXT,
  p_arrondissement TEXT,
  p_quartier TEXT,
  p_superficie NUMERIC,
  p_valeur_locative NUMERIC,
  p_start_year INTEGER DEFAULT 2023
) RETURNS JSONB AS $$
DECLARE
  v_contrib_id UUID;
  v_liq_id UUID;
  v_ref_liq TEXT;
  v_base NUMERIC;
  v_count INTEGER;
BEGIN
  -- Upsert Contribuable
  INSERT INTO public.contribuables (nom_prenoms, ifu_npi, telephone, commune, arrondissement, quartier)
  VALUES (p_nom_prenoms, p_ifu_npi, p_telephone, UPPER(p_commune), UPPER(p_arrondissement), UPPER(p_quartier))
  ON CONFLICT (ifu_npi) DO UPDATE SET
    nom_prenoms = EXCLUDED.nom_prenoms,
    telephone = EXCLUDED.telephone,
    commune = EXCLUDED.commune,
    arrondissement = EXCLUDED.arrondissement,
    quartier = EXCLUDED.quartier
  RETURNING id INTO v_contrib_id;

  -- Calcul référence
  SELECT COUNT(*) + 1 INTO v_count FROM public.liquidations;
  v_ref_liq := 'LIQ-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(v_count::text, 5, '0');
  v_base := p_superficie * p_valeur_locative;

  -- Créer la liquidation
  INSERT INTO public.liquidations (reference_liq, contribuable_id, superficie, valeur_locative, start_year, base_imposable, status)
  VALUES (v_ref_liq, v_contrib_id, p_superficie, p_valeur_locative, p_start_year, v_base, 'EN_ATTENTE')
  RETURNING id INTO v_liq_id;

  RETURN jsonb_build_object(
    'liquidation_id', v_liq_id,
    'reference_liq', v_ref_liq,
    'contribuable_id', v_contrib_id,
    'status', 'EN_ATTENTE'
  );
END;
$$ LANGUAGE plpgsql;

-- B. Validation du Paiement & Génération de l'Avis de Mise en Recouvrement
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
  v_location_str TEXT;
  v_desc TEXT;
  i INTEGER;
BEGIN
  -- Verrouillage de la liquidation
  SELECT * INTO v_liq FROM public.liquidations WHERE id = p_liquidation_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation introuvable';
  END IF;

  IF v_liq.status = 'PAYE' THEN
    RAISE EXCEPTION 'Cette liquidation a déjà été payée et validée.';
  END IF;

  -- Charger le contribuable
  SELECT * INTO v_contrib FROM public.contribuables WHERE id = v_liq.contribuable_id;

  -- Obtenir ou créer le Rôle ACTIF
  -- ORDER BY created_at ASC garantit qu'on prend toujours le même rôle (le plus ancien)
  -- même si des doublons existent en base, ce qui assure la continuité des numéros d'articles.
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

  -- Obtenir le dernier numéro d'article du rôle
  SELECT COALESCE(MAX(ar.numero_article), 0) INTO v_last_article_num
  FROM public.articles_recouvrement ar
  JOIN public.recouvrements r ON ar.recouvrement_id = r.id
  WHERE r.role_id = v_role_id;

  -- Créer le recouvrement
  INSERT INTO public.recouvrements (liquidation_id, role_id, contribuable_id)
  VALUES (p_liquidation_id, v_role_id, v_contrib.id)
  RETURNING id INTO v_recouvrement_id;

  -- Marquer la liquidation comme PAYEE et tracer l'audit
  UPDATE public.liquidations 
  SET 
    status = 'PAYE',
    validated_by = auth.uid(),
    validated_at = now()
  WHERE id = p_liquidation_id;

  -- Générer les 4 articles séquentiels
  v_base := v_liq.superficie * v_liq.valeur_locative;
  v_location_str := UPPER(v_contrib.commune || '/' || v_contrib.arrondissement || '/' || v_contrib.quartier);
  v_desc := 'PARCELLE DE ' || v_liq.superficie || ' M² SISE A ' || v_location_str;

  FOR i IN 0..3 LOOP
    v_exercise_year := v_liq.start_year + i;
    v_taux := CASE WHEN i = 0 THEN 0.04 ELSE 0.05 END;
    v_droit := v_base * v_taux;
    v_last_article_num := v_last_article_num + 1;

    INSERT INTO public.articles_recouvrement (
      recouvrement_id, numero_article, exercice, nature_impot,
      localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du
    ) VALUES (
      v_recouvrement_id, v_last_article_num, v_exercise_year, 'TFU/FNB',
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

-- C. Clôture de Rôle Actif
CREATE OR REPLACE FUNCTION public.cloturer_role_actif(
  p_commune TEXT
) RETURNS JSONB AS $$
DECLARE
  v_role_id UUID;
  v_old_num INTEGER;
  v_new_num INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  SELECT id, numero_role INTO v_role_id, v_old_num
  FROM public.roles
  WHERE commune = UPPER(p_commune) AND annee = v_current_year AND status = 'ACTIF';

  IF FOUND THEN
    UPDATE public.roles SET status = 'CLOTURE' WHERE id = v_role_id;
    v_new_num := v_old_num + 1;
  ELSE
    v_new_num := 1;
  END IF;

  INSERT INTO public.roles (commune, annee, numero_role, status)
  VALUES (UPPER(p_commune), v_current_year, v_new_num, 'ACTIF');

  RETURN jsonb_build_object(
    'commune', UPPER(p_commune),
    'annee', v_current_year,
    'nouveau_numero_role', v_new_num
  );
END;
$$ LANGUAGE plpgsql;
