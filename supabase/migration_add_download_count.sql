-- Migration to add download tracking to liquidations and tps_liquidations tables

ALTER TABLE public.liquidations 
ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.tps_liquidations 
ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
