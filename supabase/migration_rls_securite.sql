-- ============================================================================
-- MIGRATION : SÉCURISATION DES POLITIQUES ROW LEVEL SECURITY (RLS)
-- Suppression des accès anon permissifs et restriction aux utilisateurs authentifiés.
-- ============================================================================

-- 1. Suppression des anciennes politiques permissives (TFU standard)
DROP POLICY IF EXISTS "Allow anon read/write roles" ON public.roles;
DROP POLICY IF EXISTS "Allow anon read/write contribuables" ON public.contribuables;
DROP POLICY IF EXISTS "Allow anon read/write liquidations" ON public.liquidations;
DROP POLICY IF EXISTS "Allow anon read/write recouvrements" ON public.recouvrements;
DROP POLICY IF EXISTS "Allow anon read/write articles" ON public.articles_recouvrement;

-- 2. Suppression des anciennes politiques permissives (TPS)
DROP POLICY IF EXISTS "Allow anon access tps_contribuables" ON public.tps_contribuables;
DROP POLICY IF EXISTS "Allow anon access tps_roles" ON public.tps_roles;
DROP POLICY IF EXISTS "Allow anon access tps_liquidations" ON public.tps_liquidations;
DROP POLICY IF EXISTS "Allow anon access tps_articles" ON public.tps_articles;

-- 3. Suppression de la lecture publique des VA
DROP POLICY IF EXISTS "Permettre la lecture publique des VA" ON public.valeurs_administratives;

-- 4. Création des nouvelles politiques restrictives pour TFU (Utilisateurs connectés uniquement)
CREATE POLICY "Allow authenticated read/write roles" 
  ON public.roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write contribuables" 
  ON public.contribuables FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write liquidations" 
  ON public.liquidations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write recouvrements" 
  ON public.recouvrements FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read/write articles" 
  ON public.articles_recouvrement FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Création des nouvelles politiques restrictives pour TPS (Utilisateurs connectés uniquement)
CREATE POLICY "Allow authenticated access tps_contribuables" 
  ON public.tps_contribuables FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access tps_roles" 
  ON public.tps_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access tps_liquidations" 
  ON public.tps_liquidations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access tps_articles" 
  ON public.tps_articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Création de la politique restrictive pour les Valeurs Administratives
CREATE POLICY "Allow authenticated read valeurs_administratives" 
  ON public.valeurs_administratives FOR SELECT TO authenticated USING (true);
