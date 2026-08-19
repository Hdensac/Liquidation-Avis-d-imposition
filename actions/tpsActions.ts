"use server";

import { getRange, PAGE_SIZE } from "@/lib/pagination";
import { createClient } from "@/utils/supabase/server";
import { logAction } from "@/actions/auditActions";
import { TpsInput, buildTpsCalculations } from "@/utils/tpsCalculations";
import { fetchCurrentUserRole } from "@/actions/liquidationActions";

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

  // On récupère la référence pour le log d'audit
  const { data: currentLiq } = await supabase
    .from("tps_liquidations")
    .select("status, contribuable_id, reference_tps")
    .eq("id", id)
    .single();

  if (!currentLiq || currentLiq.status !== "EN_ATTENTE") {
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
    reference_tps: currentLiq.reference_tps,
    nom_raison_sociale: data.nomRaisonSociale,
    ifu_nc: data.ifuNc,
  });

  return { success: true };
}

export async function fetchPendingLiquidationsTps(params: { page: number }) {
  const supabase = await createClient();
  const [from, to] = getRange(params.page, PAGE_SIZE);

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

  const { data: currentLiq } = await supabase
    .from("tps_liquidations")
    .select("reference_tps")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("tps_liquidations")
    .update({ status: "ANNULE" })
    .eq("id", id);

  if (error) throw error;

  await logAction("ANNULATION_LIQUIDATION_TPS", {
    liquidation_id: id,
    reference_tps: currentLiq?.reference_tps
  });
  return { success: true };
}

export async function validerPaiementTps(id: string) {
  const supabase = await createClient();

  const { data: currentLiq } = await supabase
    .from("tps_liquidations")
    .select("reference_tps")
    .eq("id", id)
    .single();

  const { data, error } = await supabase.rpc("valider_paiement_tps", {
    p_liquidation_id: id,
  });

  if (error) {
    console.error("Erreur RPC valider_paiement_tps:", error);
    throw error;
  }

  await logAction("VALIDATION_PAIEMENT_TPS", {
    liquidation_id: id,
    reference_tps: currentLiq?.reference_tps,
    role_id: data?.role_id,
    first_article_num: data?.first_article_num,
    last_article_num: data?.last_article_num,
  });

  return data;
}

export async function fetchAvisValidesTps(params: { page: number }) {
  const supabase = await createClient();
  const [from, to] = getRange(params.page, PAGE_SIZE);

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

export async function incrementTpsDownloadCount(liquidationId: string) {
  const supabase = await createClient();

  // 1. Fetch current download count
  const { data, error: fetchError } = await supabase
    .from("tps_liquidations")
    .select("download_count")
    .eq("id", liquidationId)
    .single();

  if (fetchError) throw fetchError;
  const currentCount = data?.download_count || 0;

  // 2. Update with incremented value
  const { error: updateError } = await supabase
    .from("tps_liquidations")
    .update({ download_count: currentCount + 1 })
    .eq("id", liquidationId);

  if (updateError) throw updateError;
}

export async function fetchRolesTps() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tps_roles")
    .select(`
      *,
      tps_articles (
        numero_article
      )
    `)
    .order("commune", { ascending: true })
    .order("numero_role", { ascending: true });

  if (error) throw error;
  
  return (data || []).map((role: any) => {
    const articles = role.tps_articles || [];
    const dernier_article = articles.reduce((max: number, art: any) => Math.max(max, art.numero_article), 0);
    // Remove the articles relation to keep the payload clean
    const { tps_articles, ...roleWithoutArticles } = role;
    return {
      ...roleWithoutArticles,
      dernier_article,
    };
  });
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

/** Modifie une liquidation TPS VALIDE existante (Réservé Inspecteur/Admin, si le rôle est ACTIF) */
export async function updatePaidTpsLiquidation(
  liquidationId: string,
  data: TpsInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Récupérer l'utilisateur courant et son rôle
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Vous devez être authentifié pour modifier." };
    }

    const currentRole = await fetchCurrentUserRole();
    if (currentRole !== "ADMIN" && currentRole !== "INSPECTEUR") {
      return { success: false, error: "Seuls les inspecteurs et administrateurs peuvent modifier une liquidation validée." };
    }

    // 2. Vérifier que la liquidation est bien VALIDE et rattachée à un rôle ACTIF
    const { data: currentLiq, error: getError } = await supabase
      .from("tps_liquidations")
      .select(`
        status, reference_tps, contribuable_id,
        activite, montant_autres_activites, tps_calcule, portb, impot_du, acomptes_payes, reste_du, start_year,
        contribuable:tps_contribuables (
          id, nom_raison_sociale, ifu_nc, telephone, commune, arrondissement, quartier, localisation
        ),
        articles:tps_articles (
          id,
          numero_article,
          role:tps_roles (
            id,
            status
          )
        )
      `)
      .eq("id", liquidationId)
      .single();

    if (getError || !currentLiq) {
      return { success: false, error: "Liquidation TPS introuvable." };
    }

    if (currentLiq.status !== "VALIDE") {
      return { success: false, error: "Seules les liquidations validées peuvent être modifiées dans l'historique." };
    }

    const articles = currentLiq.articles || [];
    if (articles.length === 0) {
      return { success: false, error: "Aucun article de recouvrement associé à cette liquidation." };
    }

    // Prendre le premier article pour vérifier le statut du rôle
    const firstArticle = articles[0];
    const role = Array.isArray(firstArticle.role) ? firstArticle.role[0] : firstArticle.role;
    if (!role || role.status !== "ACTIF") {
      return { success: false, error: "Ce rôle TPS est déjà clôturé. Les modifications sont impossibles." };
    }

    // Sauvegarder les données avant modification pour le log d'audit
    const contrib = currentLiq.contribuable;
    const contribData = Array.isArray(contrib) ? contrib[0] : contrib;
    const data_avant: TpsInput = {
      nomRaisonSociale: contribData?.nom_raison_sociale || "",
      ifuNc: contribData?.ifu_nc || "",
      telephone: contribData?.telephone || "",
      commune: contribData?.commune || "",
      arrondissement: contribData?.arrondissement || "",
      quartier: contribData?.quartier || "",
      localisation: contribData?.localisation || "",
      activite: currentLiq.activite || "",
      montantAutresActivites: currentLiq.montant_autres_activites ?? 0,
      acomptesPayes: currentLiq.acomptes_payes ?? 0,
      startYear: currentLiq.start_year ?? 2023,
    };

    // 3. Vérifier si le nouvel IFU NC est déjà utilisé par un autre contribuable
    const { data: existingContrib } = await supabase
      .from("tps_contribuables")
      .select("id, nom_raison_sociale")
      .eq("ifu_nc", data.ifuNc)
      .neq("id", currentLiq.contribuable_id)
      .maybeSingle();

    const oldContribId = currentLiq.contribuable_id;
    let finalContribId = oldContribId;

    if (existingContrib) {
      const cleanName = (n: string) => n.trim().toUpperCase().replace(/\s+/g, " ");
      if (cleanName(existingContrib.nom_raison_sociale) === cleanName(data.nomRaisonSociale)) {
        finalContribId = existingContrib.id;
      } else {
        return { 
          success: false, 
          error: `Cet IFU NC est déjà associé au contribuable "${existingContrib.nom_raison_sociale}" dans le système.` 
        };
      }
    }

    // 4. Mettre à jour le contribuable TPS
    if (finalContribId === oldContribId) {
      const { error: contribError } = await supabase
        .from("tps_contribuables")
        .update({
          nom_raison_sociale: data.nomRaisonSociale,
          ifu_nc: data.ifuNc,
          telephone: data.telephone || null,
          commune: data.commune.toUpperCase(),
          arrondissement: data.arrondissement.toUpperCase(),
          quartier: data.quartier.toUpperCase(),
          localisation: data.localisation || null,
        })
        .eq("id", oldContribId);

      if (contribError) return { success: false, error: "Erreur lors de la mise à jour du contribuable TPS." };
    } else {
      await supabase
        .from("tps_contribuables")
        .update({
          telephone: data.telephone || null,
          commune: data.commune.toUpperCase(),
          arrondissement: data.arrondissement.toUpperCase(),
          quartier: data.quartier.toUpperCase(),
          localisation: data.localisation || null,
        })
        .eq("id", finalContribId);
    }

    // 5. Recalculer les droits TPS
    const calculations = buildTpsCalculations(data);

    // 6. Mettre à jour la liquidation TPS
    const { error: liqError } = await supabase
      .from("tps_liquidations")
      .update({
        contribuable_id: finalContribId,
        activite: data.activite,
        montant_autres_activites: Number(data.montantAutresActivites) || 0,
        tps_calcule: calculations.tpsCalcule,
        portb: calculations.portb,
        impot_du: calculations.impotDu,
        acomptes_payes: Number(data.acomptesPayes) || 0,
        reste_du: calculations.resteDu,
        start_year: calculations.startYear,
      })
      .eq("id", liquidationId);

    if (liqError) return { success: false, error: "Erreur lors de la mise à jour de la liquidation TPS." };

    // Nettoyer l'ancien contribuable TPS s'il est orphelin
    if (finalContribId !== oldContribId) {
      const { count } = await supabase
        .from("tps_liquidations")
        .select("id", { count: "exact", head: true })
        .eq("contribuable_id", oldContribId);

      if (count === 0) {
        await supabase.from("tps_contribuables").delete().eq("id", oldContribId);
      }
    }

    // 7. Mettre à jour les exercices dans les tps_articles
    const sortedArticles = [...articles].sort((a: any, b: any) => a.numero_article - b.numero_article);
    for (let i = 0; i < sortedArticles.length; i++) {
      const art = sortedArticles[i];
      await supabase
        .from("tps_articles")
        .update({
          exercice: calculations.startYear + i,
        })
        .eq("id", art.id);
    }

    // 8. Logger l'action
    await logAction("MODIFICATION_FINANCIERE_LIQUIDATION_TPS_VALIDE", {
      reference_tps: currentLiq.reference_tps,
      user_id: user.id,
      role: currentRole,
      data_avant: data_avant,
      data_apres: data
    });

    return { success: true };
  } catch (e: any) {
    console.error("updatePaidTpsLiquidation error:", e);
    return { success: false, error: e?.message || "Une erreur inattendue est survenue." };
  }
}

