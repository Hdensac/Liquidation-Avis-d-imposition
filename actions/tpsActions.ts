"use server";

import { getRange, PAGE_SIZE } from "@/lib/pagination";
import { createClient } from "@/utils/supabase/server";
import { logAction } from "@/actions/auditActions";
import { TpsInput } from "@/utils/tpsCalculations";

export async function createLiquidationTps(data: TpsInput) {
  const supabase = await createClient();

  const { error, data: result } = await supabase.rpc("creer_liquidation_tps", {
    p_nom_raison_sociale: data.nomRaisonSociale,
    p_ifu_nc: data.ifuNc,
    p_telephone: data.telephone || null,
    p_commune: data.commune.toUpperCase(),
    p_arrondissement: data.arrondissement.toUpperCase(),
    p_quartier: data.quartier.toUpperCase(),
    p_localisation: data.localisation || null,
    p_activite: data.activite,
    p_montant_autres_activites: Number(data.montantAutresActivites) || 0,
    p_acomptes_payes: Number(data.acomptesPayes) || 0,
    p_start_year: Number(data.startYear) || 2024,
  });

  if (error) {
    console.error("Erreur creation liquidation TPS:", error);
    throw error;
  }

  await logAction("CREATION_LIQUIDATION_TPS", {
    reference_tps: result?.reference_tps,
    nom_raison_sociale: data.nomRaisonSociale,
    ifu_nc: data.ifuNc,
    commune: data.commune,
  });

  return result;
}

export async function updateLiquidationTps(id: string, data: TpsInput) {
  const supabase = await createClient();

  // On vérifie que la liquidation est bien en attente avant de la modifier
  const { data: currentLiq, error: getErr } = await supabase
    .from("tps_liquidations")
    .select("status, contribuable_id")
    .eq("id", id)
    .single();

  if (getErr || !currentLiq) {
    throw new Error("Liquidation TPS introuvable.");
  }

  if (currentLiq.status !== "EN_ATTENTE") {
    throw new Error("Seules les liquidations en attente peuvent être modifiées.");
  }

  // Calculs financiers côté serveur
  const tpsCalcule = Math.round(Number(data.montantAutresActivites) * 0.05);
  const impotDu = tpsCalcule + 4000;
  const resteDu = impotDu - Number(data.acomptesPayes);

  // Mettre à jour le contribuable
  const { error: contribErr } = await supabase
    .from("tps_contribuables")
    .update({
      nom_raison_sociale: data.nomRaisonSociale,
      telephone: data.telephone || null,
      commune: data.commune.toUpperCase(),
      arrondissement: data.arrondissement.toUpperCase(),
      quartier: data.quartier.toUpperCase(),
      localisation: data.localisation || null,
    })
    .eq("id", currentLiq.contribuable_id);

  if (contribErr) throw contribErr;

  // Mettre à jour la liquidation
  const { error: liqErr } = await supabase
    .from("tps_liquidations")
    .update({
      activite: data.activite,
      montant_autres_activites: Number(data.montantAutresActivites) || 0,
      tps_calcule: tpsCalcule,
      impot_du: impotDu,
      acomptes_payes: Number(data.acomptesPayes) || 0,
      reste_du: resteDu,
      start_year: Number(data.startYear) || 2024,
    })
    .eq("id", id);

  if (liqErr) throw liqErr;

  await logAction("MODIFICATION_LIQUIDATION_TPS", {
    liquidation_id: id,
    nom_raison_sociale: data.nomRaisonSociale,
    ifu_nc: data.ifuNc,
  });

  return { success: true };
}

export async function fetchPendingLiquidationsTps(params: { page: number }) {
  const supabase = await createClient();
  const { from, to } = getRange(params.page, PAGE_SIZE);

  const { data, error, count } = await supabase
    .from("tps_liquidations")
    .select("*, contribuable:tps_contribuables(*)", { count: "exact" })
    .eq("status", "EN_ATTENTE")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

export async function cancelLiquidationTps(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tps_liquidations")
    .update({ status: "ANNULE" })
    .eq("id", id);

  if (error) throw error;

  await logAction("ANNULATION_LIQUIDATION_TPS", { liquidation_id: id });
  return { success: true };
}

export async function validerPaiementTps(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("valider_paiement_tps", {
    p_liquidation_id: id,
  });

  if (error) {
    console.error("Erreur RPC valider_paiement_tps:", error);
    throw error;
  }

  await logAction("VALIDATION_PAIEMENT_TPS", {
    liquidation_id: id,
    role_id: data?.role_id,
    first_article_num: data?.first_article_num,
    last_article_num: data?.last_article_num,
  });

  return data;
}

export async function fetchAvisValidesTps(params: { page: number }) {
  const supabase = await createClient();
  const { from, to } = getRange(params.page, PAGE_SIZE);

  const { data, error, count } = await supabase
    .from("tps_liquidations")
    .select("*, contribuable:tps_contribuables(*), articles:tps_articles(*, role:tps_roles(*))", { count: "exact" })
    .eq("status", "VALIDE")
    .order("validated_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data: data || [],
    totalCount: count || 0,
  };
}

export async function fetchRolesTps() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tps_roles")
    .select("*")
    .order("commune", { ascending: true })
    .order("numero_role", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchRoleDetailsTps(roleId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tps_articles")
    .select("*, liquidation:tps_liquidations(*, contribuable:tps_contribuables(*))")
    .eq("role_id", roleId)
    .order("numero_article", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function cloturerRoleTps(commune: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("cloturer_role_tps", {
    p_commune: commune.toUpperCase(),
  });

  if (error) {
    console.error("Erreur RPC cloturer_role_tps:", error);
    throw error;
  }

  await logAction("CLOTURE_ROLE_TPS", {
    commune: commune,
    nouveau_numero_role: data?.nouveau_numero_role,
  });

  return data;
}
