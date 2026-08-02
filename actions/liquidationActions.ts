"use server";

// actions/liquidationActions.ts
import { createClient } from "@/utils/supabase/server";
import { TaxpayerInput } from "@/types/liquidation";
import type { AvisRecouvrementDetails } from "@/utils/avisPdfGenerator";

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liquidations")
    .select("contribuable:contribuables (commune)")
    .eq("id", liquidationId)
    .maybeSingle();

  if (error) throw error;
  return extractCommune(data as LiquidationCommuneRow | null);
}

async function fetchLatestLiquidationCommune() {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  let query = supabase
    .from("liquidations")
    .select(
      "id, reference_liq, status, created_at, superficie, valeur_locative, start_year, contribuable:contribuables (nom_prenoms, ifu_npi, telephone, commune, arrondissement, quartier)"
    )
    .eq("status", "EN_ATTENTE");

  if (ifu) query = query.ilike("contribuable.ifu_npi", `%${ifu}%`);
  if (name) query = query.ilike("contribuable.nom_prenoms", `%${name}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Validate payment and generate recouvrement/avis.
 *  NOTE: Role creation is handled atomically inside the SQL RPC (FOR UPDATE lock).
 *  Do NOT call ensureActiveRole here — it would create a race condition
 *  leading to duplicate ACTIF roles for the same commune.
 */
export async function validatePayment(liquidationId: string) {
  const supabase = await createClient();
  const { error, data: result } = await supabase.rpc("valider_paiement_liquidation", {
    p_liquidation_id: liquidationId,
  });
  if (error) throw error;
  return result;
}

/** Close active role for a commune and create next role */
export async function closeActiveRole(commune: string) {
  const supabase = await createClient();
  const { error, data: result } = await supabase.rpc("cloturer_role_actif", {
    p_commune: commune,
  });
  if (error) throw error;
  return result;
}

/** Fetch all roles with aggregate stats (nb recouvrements, total droits, dernier article) */
export async function fetchAllRoles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(`
      id,
      numero_role,
      commune,
      annee,
      status,
      created_at,
      recouvrements (
        id,
        articles_recouvrement ( droit_simple, numero_article )
      )
    `)
    .order("annee", { ascending: false })
    .order("numero_role", { ascending: false });

  if (error) throw error;

  // Compute derived stats client-side to avoid complex SQL
  return (data ?? []).map((role) => {
    const recouvrements = role.recouvrements ?? [];
    const allArticles = recouvrements.flatMap((r: { articles_recouvrement: { droit_simple: number; numero_article: number }[] }) => r.articles_recouvrement ?? []);
    const totalDroits = allArticles.reduce((sum: number, a: { droit_simple: number }) => sum + (Number(a.droit_simple) || 0), 0);
    const lastArticle = allArticles.length > 0
      ? Math.max(...allArticles.map((a: { numero_article: number }) => Number(a.numero_article) || 0))
      : 0;
    return {
      id: role.id as string,
      numero_role: Number(role.numero_role),
      commune: role.commune as string,
      annee: Number(role.annee),
      status: role.status as "ACTIF" | "CLOTURE",
      created_at: role.created_at as string,
      nb_recouvrements: recouvrements.length,
      total_droits: totalDroits,
      dernier_article: lastArticle,
    };
  });
}

export type RoleSummary = Awaited<ReturnType<typeof fetchAllRoles>>[number];

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

export async function fetchAvisRecouvrementDetails(liquidationId: string): Promise<AvisRecouvrementDetails> {
  const supabase = await createClient();
  const { data: recouvrement, error: recouvrementError } = await supabase
    .from("recouvrements")
    .select("id, liquidation_id, role_id, contribuable_id, date_paiement")
    .eq("liquidation_id", liquidationId)
    .maybeSingle();

  if (recouvrementError) throw recouvrementError;
  if (!recouvrement) {
    throw new Error("Avis de recouvrement introuvable pour cette liquidation.");
  }

  const { data: liquidation, error: liquidationError } = await supabase
    .from("liquidations")
    .select("id, reference_liq, superficie, valeur_locative, start_year, status, created_at")
    .eq("id", liquidationId)
    .maybeSingle();

  if (liquidationError) throw liquidationError;
  if (!liquidation) {
    throw new Error("Liquidation introuvable.");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, numero_role, commune, annee, status")
    .eq("id", recouvrement.role_id)
    .maybeSingle();

  if (roleError) throw roleError;
  if (!role) {
    throw new Error("Role de recouvrement introuvable.");
  }

  const { data: contribuable, error: contribuableError } = await supabase
    .from("contribuables")
    .select("id, nom_prenoms, ifu_npi, telephone, commune, arrondissement, quartier")
    .eq("id", recouvrement.contribuable_id)
    .maybeSingle();

  if (contribuableError) throw contribuableError;
  if (!contribuable) {
    throw new Error("Contribuable introuvable.");
  }

  const { data: articles, error: articlesError } = await supabase
    .from("articles_recouvrement")
    .select(
      "id, numero_article, exercice, nature_impot, localisation, description, base, taux, droit_simple, penalite, acompte_paye, reste_du"
    )
    .eq("recouvrement_id", recouvrement.id)
    .order("numero_article", { ascending: true });

  if (articlesError) throw articlesError;

  return {
    recouvrement: {
      id: recouvrement.id,
      liquidation_id: recouvrement.liquidation_id,
      role_id: recouvrement.role_id,
      contribuable_id: recouvrement.contribuable_id,
      date_paiement: recouvrement.date_paiement,
    },
    liquidation: {
      id: liquidation.id,
      reference_liq: liquidation.reference_liq,
      superficie: Number(liquidation.superficie) || 0,
      valeur_locative: Number(liquidation.valeur_locative) || 0,
      start_year: Number(liquidation.start_year) || getCurrentYear(),
      status: liquidation.status,
      created_at: liquidation.created_at,
    },
    role: {
      id: role.id,
      numero_role: Number(role.numero_role) || 1,
      commune: role.commune,
      annee: Number(role.annee) || getCurrentYear(),
      status: role.status,
    },
    contribuable: {
      id: contribuable.id,
      nom_prenoms: contribuable.nom_prenoms,
      ifu_npi: contribuable.ifu_npi,
      telephone: contribuable.telephone || "",
      commune: contribuable.commune || "",
      arrondissement: contribuable.arrondissement || "",
      quartier: contribuable.quartier || "",
    },
    articles: (articles ?? []).map((article) => ({
      id: article.id,
      numero_article: Number(article.numero_article) || 0,
      exercice: Number(article.exercice) || getCurrentYear(),
      nature_impot: article.nature_impot,
      localisation: article.localisation,
      description: article.description,
      base: Number(article.base) || 0,
      taux: Number(article.taux) || 0,
      droit_simple: Number(article.droit_simple) || 0,
      penalite: Number(article.penalite) || 0,
      acompte_paye: Number(article.acompte_paye) || 0,
      reste_du: Number(article.reste_du) || 0,
    })),
  };
}
/** Types pour le détail des rôles pour le rapport */
export interface RoleDetailItem {
  reference: string;
  ifu_npi: string;
  destinataire: string;
  articles_range: string;
  total_droits: number;
}

/** Récupère la liste détaillée des avis/liquidations associés à un rôle */
export async function fetchRoleDetails(roleId: string): Promise<RoleDetailItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recouvrements")
    .select(`
      id,
      liquidation:liquidations (
        reference_liq
      ),
      contribuable:contribuables (
        nom_prenoms,
        ifu_npi
      ),
      articles_recouvrement (
        numero_article,
        droit_simple
      )
    `)
    .eq("role_id", roleId);

  if (error) throw error;
  if (!data) return [];

  return data.map((item: any) => {
    const liq = Array.isArray(item.liquidation) ? item.liquidation[0] : item.liquidation;
    const contrib = Array.isArray(item.contribuable) ? item.contribuable[0] : item.contribuable;
    const articles = item.articles_recouvrement ?? [];

    const nums = articles
      .map((a: { numero_article: number }) => Number(a.numero_article) || 0)
      .sort((a: number, b: number) => a - b);

    let articlesRange = "-";
    if (nums.length === 1) {
      articlesRange = `Art. ${nums[0]}`;
    } else if (nums.length > 1) {
      articlesRange = `Art. ${nums[0]} à ${nums[nums.length - 1]}`;
    }

    const totalDroits = articles.reduce(
      (sum: number, a: { droit_simple: number }) => sum + (Number(a.droit_simple) || 0),
      0
    );

    return {
      reference: liq?.reference_liq || "-",
      ifu_npi: contrib?.ifu_npi || "-",
      destinataire: contrib?.nom_prenoms || "-",
      articles_range: articlesRange,
      total_droits: totalDroits,
    };
  });
}