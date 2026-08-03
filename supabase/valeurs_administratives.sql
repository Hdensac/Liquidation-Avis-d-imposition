-- ============================================================================
-- MIGRATION : TABLE DES VALEURS ADMINISTRATIVES PAR COMMUNE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.valeurs_administratives (
  commune TEXT PRIMARY KEY,
  valeur_administrative NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS (Row-Level Security)
ALTER TABLE public.valeurs_administratives ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre le SELECT public à tout le monde
CREATE POLICY "Permettre la lecture publique des VA" 
  ON public.valeurs_administratives 
  FOR SELECT 
  TO public 
  USING (true);

-- Insertion des valeurs par défaut demandées :
-- Tori-Bossito (240), Allada (200), Toffo (300) et Zè (300)
INSERT INTO public.valeurs_administratives (commune, valeur_administrative)
VALUES 
  ('TORI-BOSSITO', 240),
  ('ALLADA', 200),
  ('TOFFO', 300),
  ('ZE', 300)
ON CONFLICT (commune) 
DO UPDATE SET valeur_administrative = EXCLUDED.valeur_administrative;

-- Fonction RPC pour récupérer dynamiquement la valeur administrative d'une commune
CREATE OR REPLACE FUNCTION public.get_va_par_commune(p_commune TEXT)
RETURNS NUMERIC 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_va NUMERIC;
BEGIN
  SELECT valeur_administrative INTO v_va 
  FROM public.valeurs_administratives 
  WHERE UPPER(commune) = UPPER(TRIM(p_commune));
  
  RETURN v_va;
END;
$$;
