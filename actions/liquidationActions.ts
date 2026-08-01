// actions/liquidationActions.ts
import { supabase } from "../lib/supabase";
import { TaxpayerInput } from "@/types/liquidation";

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
// Get the active role for a commune (or first active role if no commune)
export async function getActiveRole(commune?: string) {
  let query = supabase
    .from("roles")
    .select("id, numero_role, commune, annee, status")
    .eq("status", "ACTIF");
  if (commune) query = query.eq("commune", commune);
  const { data, error } = await query.limit(1).single();
  if (error) throw error;
  return data;
}
