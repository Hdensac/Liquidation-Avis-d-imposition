-- ============================================================================
-- SCRIPT DE MIGRATION SUPABASE : SYSTEME D'ADMINISTRATION FISCALE D'ETAT
-- Avis de Mise en Recouvrement (TFU / FNB) - RÃ©publique du BÃ©nin
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
  superficie_imposable NUMERIC,
  valeur_locative NUMERIC NOT NULL,
  start_year INTEGER NOT NULL DEFAULT 2023,
  type_bien TEXT NOT NULL DEFAULT 'NON_BATI' CHECK (type_bien IN ('NON_BATI', 'BATI')),
  base_imposable NUMERIC NOT NULL,
  status liquidation_status NOT NULL DEFAULT 'EN_ATTENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 4: recouvrements (Paiements validÃ©s)
CREATE TABLE IF NOT EXISTS public.recouvrements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liquidation_id UUID UNIQUE NOT NULL REFERENCES public.liquidations(id) ON DELETE RESTRICT,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  contribuable_id UUID NOT NULL REFERENCES public.contribuables(id) ON DELETE RESTRICT,
  date_paiement TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 5: articles_recouvrement (Lignes d'exercice numÃ©rotÃ©es)
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

-- 4. ROW LEVEL SECURITY (RLS) - Permettre la lecture/Ã©criture publique (Anon Key)
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

-- A. CrÃ©ation d'une Liquidation en Attente
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
  v_base := COALESCE(v_superficie_imposable, p_superficie) * p_valeur_locative;

  -- Créer la liquidation
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
  ) VALUES (
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

-- B. Validation du Paiement & GÃ©nÃ©ration de l'Avis de Mise en Recouvrement
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
  -- Verrouillage de la liquidation
  SELECT * INTO v_liq FROM public.liquidations WHERE id = p_liquidation_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liquidation introuvable';
  END IF;

  IF v_liq.status = 'PAYE' THEN
    RAISE EXCEPTION 'Cette liquidation a deja ete payee et validee.';
  END IF;

  -- Charger le contribuable
  SELECT * INTO v_contrib FROM public.contribuables WHERE id = v_liq.contribuable_id;

  -- Obtenir ou créer le Rôle ACTIF
  SELECT id, numero_role INTO v_role_id, v_role_num
  FROM public.roles
  WHERE commune = v_contrib.commune AND annee = v_current_year AND status = 'ACTIF'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Lire le numero de depart configure pour la commune et l'annee (defaut a 1)
    SELECT COALESCE(s.initial_numero_role, 1) INTO v_role_num
    FROM public.role_commune_settings s
    WHERE s.commune = v_contrib.commune AND s.annee = v_current_year;

    IF v_role_num IS NULL THEN
      v_role_num := 1;
    END IF;

    INSERT INTO public.roles (commune, annee, numero_role, status)
    VALUES (v_contrib.commune, v_current_year, v_role_num, 'ACTIF')
    RETURNING id, numero_role INTO v_role_id, v_role_num;
  END IF;

  -- Obtenir le dernier numéro d'article du rôle
  SELECT COALESCE(MAX(ar.numero_article), 0) INTO v_last_article_num
  FROM public.articles_recouvrement ar
  JOIN public.recouvrements r ON ar.recouvrement_id = r.id
  WHERE r.role_id = v_role_id;

  -- Block if article limit will be exceeded (4 articles generated)
  IF v_last_article_num + 4 > 100 THEN
    RAISE EXCEPTION 'Le numéro d''article ne peut pas dépasser 100. (Actuel: %, requis: 4). Veuillez clôturer le rôle actuel de % et en créer un nouveau.', v_last_article_num, v_contrib.commune;
  END IF;

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

-- C. ClÃ´ture de RÃ´le Actif
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
  WHERE commune = UPPER(p_commune) AND annee = v_current_year AND status = 'ACTIF'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.roles SET status = 'CLOTURE' WHERE id = v_role_id;
    v_new_num := v_old_num + 1;
  ELSE
    -- Lire le numero de depart configure pour la commune et l'annee (defaut a 1)
    SELECT COALESCE(s.initial_numero_role, 1) INTO v_new_num
    FROM public.role_commune_settings s
    WHERE s.commune = UPPER(p_commune) AND s.annee = v_current_year;

    IF v_new_num IS NULL THEN
      v_new_num := 1;
    END IF;
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
