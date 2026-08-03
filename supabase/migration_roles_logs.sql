-- ============================================================================
-- MIGRATION : SYSTEME DE ROLES (RBAC) & JOURNALISATION (AUDIT LOGS)
-- ============================================================================

-- 1. TYPES & ENUMS
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('ADMIN', 'AGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLE DES PROFILS UTILISATEURS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  fullname TEXT,
  role public.user_role DEFAULT NULL, -- NULL = En attente d'attribution
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABLE DES LOGS D'AUDIT (JOURNALISATION)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. FONCTION SECURISÉE POUR EVITER LA RECURSION SUR LES POLITIQUES DE PROFIL
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'ADMIN'::public.user_role FROM public.profiles WHERE id = auth.uid()),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour 'profiles'
DROP POLICY IF EXISTS "Lecture de son propre profil" ON public.profiles;
CREATE POLICY "Lecture de son propre profil" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Lecture totale pour les admins" ON public.profiles;
CREATE POLICY "Lecture totale pour les admins" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Modification des profils par les admins" ON public.profiles;
CREATE POLICY "Modification des profils par les admins" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Politiques RLS pour 'audit_logs'
DROP POLICY IF EXISTS "Lecture des logs par les admins" ON public.audit_logs;
CREATE POLICY "Lecture des logs par les admins" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Insertion des logs par les utilisateurs connectes" ON public.audit_logs;
CREATE POLICY "Insertion des logs par les utilisateurs connectes" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 6. DÉCLENCHEUR (TRIGGER) POUR LA CREATION DU PROFIL A L'INSCRIPTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, fullname, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    NULL -- Rôle non attribué par défaut
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. IMPORTATION DES UTILISATEURS EXISTANTS (SI APPLICABLE)
INSERT INTO public.profiles (id, email, fullname, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', ''), NULL
FROM auth.users
ON CONFLICT (id) DO NOTHING;
