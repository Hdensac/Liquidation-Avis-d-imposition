-- ============================================================================
-- SUPABASE MIGRATION: INDEX DE PERFORMANCE SANS REDONDANCE
-- ============================================================================

-- 1. Table ROLES
-- Un seul index composé couvre (commune, annee, status) ET les recherches sur commune
CREATE INDEX IF NOT EXISTS idx_roles_commune_annee_status ON public.roles(commune, annee, status);
CREATE INDEX IF NOT EXISTS idx_roles_created_at ON public.roles(created_at DESC);

-- 2. Table LIQUIDATIONS
-- L'index composé (status, created_at DESC) couvre déjà les recherches filtrées uniquement sur 'status'
CREATE INDEX IF NOT EXISTS idx_liquidations_status_created_at ON public.liquidations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_liquidations_contribuable_id ON public.liquidations(contribuable_id);
-- Index standalone pour le tri DESC sur created_at (pagination paginée sans filtre status explicite)
CREATE INDEX IF NOT EXISTS idx_liquidations_created_at ON public.liquidations (created_at DESC);

-- 3. Table CONTRIBUABLES
CREATE INDEX IF NOT EXISTS idx_contribuables_ifu ON public.contribuables(ifu_npi);

-- 4. Table RECOUVREMENTS
CREATE INDEX IF NOT EXISTS idx_recouvrements_role_id ON public.recouvrements(role_id);
CREATE INDEX IF NOT EXISTS idx_recouvrements_liquidation_id ON public.recouvrements(liquidation_id);

-- 5. Table ARTICLES_RECOUVREMENT
-- L'index composé (recouvrement_id, numero_article) couvre déjà la recherche sur 'recouvrement_id' seul
CREATE INDEX IF NOT EXISTS idx_articles_recouvrement_recouvrement_numero ON public.articles_recouvrement(recouvrement_id, numero_article);