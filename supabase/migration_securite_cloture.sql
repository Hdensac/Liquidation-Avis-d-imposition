-- Script de migration pour sécuriser la clôture des rôles
-- Ajoute le verrou FOR UPDATE pour éviter les collisions avec les validations de paiements

CREATE OR REPLACE FUNCTION public.cloturer_role_actif(
  p_commune TEXT
) RETURNS JSONB AS $$
DECLARE
  v_role_id UUID;
  v_old_num INTEGER;
  v_new_num INTEGER;
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
  -- L'ajout de FOR UPDATE garantit que personne d'autre ne modifie ce rôle en même temps
  SELECT id, numero_role INTO v_role_id, v_old_num
  FROM public.roles
  WHERE commune = UPPER(p_commune) AND annee = v_current_year AND status = 'ACTIF'
  FOR UPDATE;

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
