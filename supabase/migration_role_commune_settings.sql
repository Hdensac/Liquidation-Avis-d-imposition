-- Script de migration pour la configuration du numéro de rôle initial par commune
-- Gère la clé composite (commune, annee) et protège les écritures via un Trigger SQL

-- 1. Table de configuration
CREATE TABLE IF NOT EXISTS public.role_commune_settings (
  commune TEXT NOT NULL,
  annee INTEGER NOT NULL,
  initial_numero_role INTEGER NOT NULL DEFAULT 1 CHECK (initial_numero_role >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (commune, annee)
);

-- 2. Sécurité Row Level Security (RLS)
ALTER TABLE public.role_commune_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture pour tous les utilisateurs authentifies" ON public.role_commune_settings;
CREATE POLICY "Lecture pour tous les utilisateurs authentifies"
  ON public.role_commune_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Ecriture reservee aux administrateurs" ON public.role_commune_settings;
CREATE POLICY "Ecriture reservee aux administrateurs"
  ON public.role_commune_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Contraintes de sécurité (Indexes uniques)
-- Empêche d'avoir plus d'un rôle actif par commune et par année
DROP INDEX IF EXISTS public.unique_active_role_per_commune_year;
CREATE UNIQUE INDEX unique_active_role_per_commune_year
ON public.roles (commune, annee)
WHERE status = 'ACTIF';

-- Empêche les doublons de numéros de rôles pour la même commune et la même année
DROP INDEX IF EXISTS public.unique_role_number_per_commune_year;
CREATE UNIQUE INDEX unique_role_number_per_commune_year
ON public.roles (commune, annee, numero_role);

-- 4. Trigger de sécurité : Bloquer les modifications si des rôles réels existent déjà
CREATE OR REPLACE FUNCTION public.check_role_settings_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.roles
    WHERE commune = NEW.commune AND annee = NEW.annee
  ) THEN
    RAISE EXCEPTION 'Impossible de modifier la configuration : des roles existent deja pour la commune % et l''annee %.', NEW.commune, NEW.annee;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lock_role_commune_settings ON public.role_commune_settings;
CREATE TRIGGER trigger_lock_role_commune_settings
BEFORE INSERT OR UPDATE ON public.role_commune_settings
FOR EACH ROW
EXECUTE FUNCTION public.check_role_settings_lock();


-- 5. Mise a jour des fonctions metier
-- Ces CREATE OR REPLACE appliquent la lecture du numero initial configure
-- dans la validation de paiement et la cloture de role.

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
