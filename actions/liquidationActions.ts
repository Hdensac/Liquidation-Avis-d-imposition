// actions/liquidationActions.ts
import { supabase } from "../lib/supabase";
import { TaxpayerInput } from "@/types/liquidation";

type RoleRecord = {
  id: string;
  numero_role: number;
  commune: string;
  annee: number;
  status: string;
};

type LiquidationCommuneRow = {
  contribuable?: {
    commune?: string | null;
  } | Array<{
    commune?: string | null;
  }>;
};

function normalizeCommune(commune: string) {
  return commune.trim().toUpperCase();
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function extractCommune(row: LiquidationCommuneRow | null | undefined) {
  const contribuable = row?.contribuable;
  if (!contribuable) return null;
  if (Array.isArray(contribuable)) {
    return contribuable[0]?.commune?.trim() || null;
  }
  return contribuable.commune?.trim() || null;
}

async function fetchLiquidationCommune(liquidationId: string) {
  const { data, error } = await supabase
    .from("liquidations")
    .select("contribuable:contribuables (commune)")
    .eq("id", liquidationId)
    .maybeSingle();

  if (error) throw error;
  return extractCommune(data as LiquidationCommuneRow | null);
}

async function fetchLatestLiquidationCommune() {
  const { data, error } = await supabase
    .from("liquidations")
    .select("contribuable:contribuables (commune)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return extractCommune(data as LiquidationCommuneRow | null);
}

async function findActiveRole(commune?: string) {
  let query = supabase
    .from("roles")
    .select("id, numero_role, commune, annee, status")
    .eq("status", "ACTIF")
    .order("created_at", { ascending: true })
    .limit(1);

  if (commune) {
    query = query.eq("commune", normalizeCommune(commune));
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as RoleRecord | null;
}

async function createInitialActiveRole(commune: string) {
  const normalizedCommune = normalizeCommune(commune);
  const { data, error } = await supabase
    .from("roles")
    .insert({
      commune: normalizedCommune,
      annee: getCurrentYear(),
      numero_role: 1,
      status: "ACTIF",
    })
    .select("id, numero_role, commune, annee, status")
    .single();

  if (error) throw error;
  return data as RoleRecord;
}

async function ensureActiveRole(commune: string) {
  const existingRole = await findActiveRole(commune);
  if (existingRole) return existingRole;

  try {
    return await createInitialActiveRole(commune);
  } catch (error) {
    const roleAfterInsert = await findActiveRole(commune);
    if (roleAfterInsert) return roleAfterInsert;
    throw error;
  }
}

/** Create a new liquidation in status EN_ATTENTE */
export async function createLiquidation(data: TaxpayerInput) {
  const { error, data: result } = await supabase.rpc("creer_liquidation", {
    p_nom_prenoms: data.fullname,
    p_ifu_npi: data.ifuNpi,
    p_telephone: data.phone,
    p_commune: data.commune,
    p_arrondissement: data.arrondissement,
    p_quartier: data.quartier,
    p_superficie: Number(data.superficie) || 0,
    p_valeur_locative: Number(data.valeurLocative) || 0,
    p_start_year: Number(data.startYear) || 2023,
  });
  if (error) throw error;
  return result;
}

/** Retrieve pending liquidations, optionally filter by IFU or name */
export async function fetchPendingLiquidations({ ifu, name }: { ifu?: string; name?: string }) {
  let query = supabase
    .from("liquidations")
    .select(
      "id, reference_liq, status, created_at, contribuable:contribuables (nom_prenoms, ifu_npi, telephone)"
    )
    .eq("status", "EN_ATTENTE");

  if (ifu) query = query.ilike("contribuable.ifu_npi", `%${ifu}%`);
  if (name) query = query.ilike("contribuable.nom_prenoms", `%${name}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Validate payment and generate recouvrement/avis */
export async function validatePayment(liquidationId: string) {
  const commune = await fetchLiquidationCommune(liquidationId);
  if (commune) {
    await ensureActiveRole(commune);
  }

  const { error, data: result } = await supabase.rpc("valider_paiement_liquidation", {
    p_liquidation_id: liquidationId,
  });
  if (error) throw error;
  return result;
}

/** Close active role for a commune and create next role */
export async function closeActiveRole(commune: string) {
  const { error, data: result } = await supabase.rpc("cloturer_role_actif", {
    p_commune: commune,
  });
  if (error) throw error;
  return result;
}

// Get the active role for a commune (or create one if the base is still empty)
export async function getActiveRole(commune?: string) {
  const role = await findActiveRole(commune);
  if (role) return role;

  if (commune) {
    return ensureActiveRole(commune);
  }

  const fallbackCommune = await fetchLatestLiquidationCommune();
  if (fallbackCommune) {
    return ensureActiveRole(fallbackCommune);
  }

  return null;
}
