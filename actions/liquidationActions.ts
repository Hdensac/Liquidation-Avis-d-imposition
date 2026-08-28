"use server";

import { getRange, PAGE_SIZE } from "@/lib/pagination";
import { createClient } from "@/utils/supabase/server";
import { TaxpayerInput } from "@/types/liquidation";
import { canApplyExoneration, type UserRole } from "@/types/user";
import type { AvisRecouvrementDetails } from "@/utils/avisPdfGenerator";
import { logAction } from "@/actions/auditActions";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";
import { taxpayerInputSchema } from "@/lib/schemas";
import { revalidateTag } from "next/cache";

/** Récupère la valeur administrative d'une commune par appel RPC */
export async function fetchValeurAdministrative(commune: string): Promise<number | null> {
  if (!commune) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_va_par_commune", {
    p_commune: commune,
  });
  if (error) {
    console.error("Erreur RPC get_va_par_commune:", error);
    return null;
  }
  return data ? Number(data) : null;
}

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

function extractCommune(row: any | null | undefined) {
  return row?.commune?.trim() || null;
}

async function fetchLiquidationCommune(liquidationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liquidations")
    .select("commune")
    .eq("id", liquidationId)
    .maybeSingle();

  if (error) throw error;
  return extractCommune(data);
}

async function fetchLatestLiquidationCommune() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("liquidations")
    .select("commune")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return extractCommune(data);
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

export async function fetchCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return (profile?.role as UserRole | null) ?? null;
}

/** Create a new liquidation in status EN_ATTENTE */
export async function createLiquidation(data: TaxpayerInput) {
  const validation = taxpayerInputSchema.safeParse(data);
  if (!validation.success) {
    const errorMsg = validation.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    throw new Error(`Données de liquidation invalides: ${errorMsg}`);
  }

  const validatedData = validation.data;
  const supabase = await createClient();
  const currentRole = await fetchCurrentUserRole();
  const hasExoneration =
    typeof validatedData.superficieImposable === "number" && validatedData.superficieImposable > 0;

  if (hasExoneration && !canApplyExoneration(currentRole)) {
    throw new Error("Exoneration reservee aux inspecteurs et administrateurs.");
  }

  const superficieImposable = hasExoneration ? validatedData.superficieImposable : null;

  const { error, data: result } = await supabase.rpc("creer_liquidation", {
    p_nom_prenoms: validatedData.fullname,
    p_ifu_npi: validatedData.ifuNpi,
    p_telephone: validatedData.phone === "01" || !validatedData.phone ? null : validatedData.phone,
    p_commune: normalizeCommune(validatedData.commune),
    p_arrondissement: validatedData.arrondissement,
    p_quartier: validatedData.quartier,
    p_superficie: Number(validatedData.superficie) || 0,
    p_valeur_locative: Number(validatedData.valeurLocative) || 0,
    p_start_year: Number(validatedData.startYear) || 2023,
    p_type_bien: validatedData.typeBien || "NON_BATI",
    p_superficie_imposable: superficieImposable,
    p_is_loue: validatedData.typeBien === "BATI" ? (validatedData.isLoue ?? false) : false,
    p_valeur_irf: validatedData.typeBien === "BATI" && validatedData.isLoue ? (Number(validatedData.valeurIrf) || null) : null,
    p_description: validatedData.typeBien === "BATI" ? (validatedData.description || null) : null,
  });
  if (error) throw error;

  // Log de l'action sans inclure d'informations nominatives sensibles ou en les limitant à la référence et commune
  await logAction("CREATION_LIQUIDATION", {
    reference_liq: result?.reference_liq,
    commune: validatedData.commune,
  });

  revalidateTag("admin-stats");
  return result;
}

/** Retrieve pending liquidations, optionally filter by IFU or name */
export async function fetchPendingLiquidations({ ifu, name }: { ifu?: string; name?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("liquidations")
    .select(
      "id, reference_liq, status, created_at, superficie, superficie_imposable, valeur_locative, start_year, type_bien, is_loue, valeur_irf, description, commune, arrondissement, quartier, contribuable:contribuables (nom_prenoms, ifu_npi, telephone)"
    )
    .eq("status", "EN_ATTENTE");

  if (ifu) query = query.ilike("contribuable.ifu_npi", `%${ifu}%`);
  if (name) query = query.ilike("contribuable.nom_prenoms", `%${name}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Paginated + sorted (created_at DESC) pending liquidations */
export async function fetchPendingLiquidationsPaginated({
  page = 1,
  search,
}: {
  page?: number;
  search?: string;
}) {
  const supabase = await createClient();
  const [from, to] = getRange(page, PAGE_SIZE);

  let selectStr =
    "id, reference_liq, status, created_at, superficie, superficie_imposable, valeur_locative, start_year, type_bien, is_loue, valeur_irf, description, commune, arrondissement, quartier, contribuable:contribuables!inner (nom_prenoms, ifu_npi, telephone)";

  let query = supabase
    .from("liquidations")
    .select(selectStr, { count: "exact" })
    .eq("status", "EN_ATTENTE");

  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    query = query.or(
      `reference_liq.ilike.${q},contribuable.nom_prenoms.ilike.${q},contribuable.ifu_npi.ilike.${q}`
    );
  }

  query = query
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []) as any[], totalCount: count ?? 0 };
}

/** Paginated + sorted (created_at DESC) paid liquidations (Historique) */
export async function fetchHistoryLiquidationsPaginated({
  page = 1,
}: {
  page?: number;
}) {
  const supabase = await createClient();
  const [from, to] = getRange(page, PAGE_SIZE);

  const { data, error, count } = await supabase
    .from("liquidations")
    .select(
      `id, reference_liq, status, created_at, validated_at, download_count, 
      superficie, superficie_imposable, valeur_locative, start_year, type_bien, is_loue, valeur_irf, description, commune, arrondissement, quartier,
      contribuable:contribuables (id, nom_prenoms, ifu_npi, telephone),
      recouvrement:recouvrements (role:roles (id, status))`,
      { count: "exact" }
    )
    .eq("status", "PAYE")
    .order("validated_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data ?? [], totalCount: count ?? 0 };
}

/** Modifie une liquidation PAYE existante (Réservé Inspecteur/Admin, si le rôle est ACTIF) */
export async function updatePaidLiquidation(
  liquidationId: string,
  data: TaxpayerInput
): Promise<{ success: boolean; error?: string }> {
  const validation = taxpayerInputSchema.safeParse(data);
  if (!validation.success) {
    const errorMsg = validation.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
    return { success: false, error: `Données de modification invalides: ${errorMsg}` };
  }
  const validatedData = validation.data as TaxpayerInput;
  data = validatedData;

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

    // 2. Vérifier que la liquidation est bien PAYE et rattachée à un rôle ACTIF
    const { data: currentLiq, error: getError } = await supabase
      .from("liquidations")
      .select(`
        status, reference_liq, contribuable_id, type_bien,
        superficie, superficie_imposable, valeur_locative, start_year, is_loue, valeur_irf, description, commune, arrondissement, quartier,
        contribuable:contribuables (
          id, nom_prenoms, ifu_npi, telephone, commune, arrondissement, quartier
        ),
        recouvrement:recouvrements (
          id,
          role:roles (
            id,
            status
          )
        )
      `)
      .eq("id", liquidationId)
      .single();

    if (getError || !currentLiq) {
      return { success: false, error: "Liquidation introuvable." };
    }

    if (currentLiq.status !== "PAYE") {
      return { success: false, error: "Seules les liquidations payées peuvent être modifiées dans l'historique." };
    }

    const rec = Array.isArray(currentLiq.recouvrement) ? currentLiq.recouvrement[0] : currentLiq.recouvrement;
    if (!rec || !rec.role) {
      return { success: false, error: "Recouvrement ou rôle associé introuvable." };
    }

    const role = Array.isArray(rec.role) ? rec.role[0] : rec.role;
    if (role.status !== "ACTIF") {
      return { success: false, error: "Ce rôle est déjà clôturé. Les modifications sont impossibles." };
    }

    // Sauvegarder les données avant modification pour le log d'audit
    const contrib = currentLiq.contribuable;
    const contribData = Array.isArray(contrib) ? contrib[0] : contrib;
    const data_avant: TaxpayerInput = {
      fullname: contribData?.nom_prenoms || "",
      ifuNpi: contribData?.ifu_npi || "",
      phone: contribData?.telephone || "",
      commune: contribData?.commune || "",
      arrondissement: contribData?.arrondissement || "",
      quartier: contribData?.quartier || "",
      typeBien: currentLiq.type_bien as any,
      superficie: currentLiq.superficie ?? "",
      superficieImposable: currentLiq.superficie_imposable ?? undefined,
      valeurLocative: currentLiq.valeur_locative ?? "",
      startYear: currentLiq.start_year ?? 2023,
      isLoue: currentLiq.is_loue ?? undefined,
      valeurIrf: currentLiq.valeur_irf ?? undefined,
      description: currentLiq.description ?? undefined,
    };

    // 3. Valider l'exonération si applicable
    const hasExoneration = typeof data.superficieImposable === "number" && data.superficieImposable > 0;
    if (hasExoneration && !canApplyExoneration(currentRole)) {
      return { success: false, error: "Exonération réservée aux inspecteurs et administrateurs." };
    }

    // 4. Vérifier si le nouvel IFU/NPI est déjà utilisé par un autre contribuable
    const { data: existingContrib } = await supabase
      .from("contribuables")
      .select("id, nom_prenoms")
      .eq("ifu_npi", data.ifuNpi)
      .neq("id", currentLiq.contribuable_id)
      .maybeSingle();

    const oldContribId = currentLiq.contribuable_id;
    let finalContribId = oldContribId;

    if (existingContrib) {
      const cleanName = (n: string) => n.trim().toUpperCase().replace(/\s+/g, " ");
      if (cleanName(existingContrib.nom_prenoms) === cleanName(data.fullname)) {
        finalContribId = existingContrib.id;
      } else {
        return { 
          success: false, 
          error: `Cet IFU/NPI est déjà associé au contribuable "${existingContrib.nom_prenoms}" dans le système.` 
        };
      }
    }

    // Si le contribuable actuel est partagé par plusieurs liquidations et que sa localisation a changé,
    // créer/associer un profil distinct pour ne pas impacter les autres liquidations du même contribuable
    const { count: liqCount } = await supabase
      .from("liquidations")
      .select("id", { count: "exact", head: true })
      .eq("contribuable_id", oldContribId);

    const normNewCommune = normalizeCommune(data.commune);
    const locationChanged = 
      contribData && (
        normalizeCommune(contribData.commune || "") !== normNewCommune ||
        (contribData.arrondissement || "") !== (data.arrondissement || "") ||
        (contribData.quartier || "") !== (data.quartier || "")
      );

    if (finalContribId === oldContribId && liqCount && liqCount > 1 && locationChanged) {
      const { data: contribSameCommune } = await supabase
        .from("contribuables")
        .select("id")
        .eq("ifu_npi", data.ifuNpi)
        .eq("commune", normNewCommune)
        .maybeSingle();

      if (contribSameCommune) {
        finalContribId = contribSameCommune.id;
      } else {
        const { data: newC, error: newCErr } = await supabase
          .from("contribuables")
          .insert({
            nom_prenoms: data.fullname,
            ifu_npi: data.ifuNpi,
            telephone: data.phone === "01" ? null : data.phone,
            commune: normNewCommune,
            arrondissement: data.arrondissement,
            quartier: data.quartier,
          })
          .select("id")
          .single();

        if (newCErr || !newC) {
          return { success: false, error: "Erreur lors de la création du profil contribuable pour la nouvelle commune." };
        }
        finalContribId = newC.id;
      }
    }

    // 5. Mettre à jour le contribuable
    if (finalContribId === oldContribId) {
      const { error: contribError } = await supabase
        .from("contribuables")
        .update({
          nom_prenoms: data.fullname,
          ifu_npi: data.ifuNpi,
          telephone: data.phone === "01" ? null : data.phone,
          commune: normalizeCommune(data.commune),
          arrondissement: data.arrondissement,
          quartier: data.quartier,
        })
        .eq("id", oldContribId);

      if (contribError) return { success: false, error: "Erreur lors de la mise à jour du contribuable." };
    } else {
      await supabase
        .from("contribuables")
        .update({
          telephone: data.phone === "01" ? null : data.phone,
          commune: normalizeCommune(data.commune),
          arrondissement: data.arrondissement,
          quartier: data.quartier,
        })
        .eq("id", finalContribId);
    }

    // 6. Recalculer les droits
    const calculations = buildLiquidationCalculations(data);
    const baseImposable = (Number(data.superficieImposable) || Number(data.superficie) || 0) * (Number(data.valeurLocative) || 0);

    // 7. Mettre à jour la liquidation
    const { error: liqError } = await supabase
      .from("liquidations")
      .update({
        contribuable_id: finalContribId,
        superficie: Number(data.superficie) || 0,
        superficie_imposable: hasExoneration ? data.superficieImposable : null,
        valeur_locative: Number(data.valeurLocative) || 0,
        start_year: Number(data.startYear) || 2023,
        base_imposable: baseImposable,
        is_loue: data.typeBien === "BATI" ? (data.isLoue ?? false) : false,
        valeur_irf: data.typeBien === "BATI" && data.isLoue ? (Number(data.valeurIrf) || null) : null,
        description: data.typeBien === "BATI" ? (data.description || null) : null,
        commune: normalizeCommune(data.commune),
        arrondissement: data.arrondissement,
        quartier: data.quartier,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", liquidationId);

    if (liqError) return { success: false, error: "Erreur lors de la mise à jour de la liquidation." };

    // Nettoyer l'ancien contribuable s'il est orphelin
    if (finalContribId !== oldContribId) {
      const { count } = await supabase
        .from("liquidations")
        .select("id", { count: "exact", head: true })
        .eq("contribuable_id", oldContribId);

      if (count === 0) {
        await supabase.from("contribuables").delete().eq("id", oldContribId);
      }
    }

    // 8. Mettre à jour les articles_recouvrement existants "en place"
    const { data: existingArticles, error: getArticlesError } = await supabase
      .from("articles_recouvrement")
      .select("id, numero_article")
      .eq("recouvrement_id", rec.id)
      .order("numero_article", { ascending: true });

    if (getArticlesError) return { success: false, error: "Impossible de récupérer les articles existants." };

    // Mettre à jour chaque article
    for (let i = 0; i < calculations.exercises.length; i++) {
      const ex = calculations.exercises[i];
      const matchingArticle = existingArticles?.[i];

      const articlePayload = {
        exercice: ex.year,
        nature_impot: ex.taxNature,
        localisation: calculations.adresseDescription,
        description: ex.description,
        base: ex.baseImposable,
        taux: ex.taux,
        droit_simple: ex.droitSimple,
        reste_du: ex.droitSimple,
      };

      if (matchingArticle) {
        await supabase
          .from("articles_recouvrement")
          .update(articlePayload)
          .eq("id", matchingArticle.id);
      } else {
        await supabase
          .from("articles_recouvrement")
          .insert({
            recouvrement_id: rec.id,
            numero_article: i + 1,
            ...articlePayload,
          });
      }
    }

    // Si le nouveau calcul génère MOINS d'articles que d'existants
    if (existingArticles && existingArticles.length > calculations.exercises.length) {
      const idsToDelete = existingArticles.slice(calculations.exercises.length).map(a => a.id);
      await supabase
        .from("articles_recouvrement")
        .delete()
        .in("id", idsToDelete);
    }

    // 9. Logger l'action
    await logAction("MODIFICATION_FINANCIERE_LIQUIDATION_PAYE", {
      reference_liq: currentLiq.reference_liq,
      user_id: user.id,
      role: currentRole,
      data_avant: data_avant,
      data_apres: data
    });

    revalidateTag("admin-stats");
    return { success: true };
  } catch (e: any) {
    console.error("updatePaidLiquidation error:", e);
    return { success: false, error: e?.message || "Une erreur inattendue est survenue." };
  }
}

/** Increments the download counter of a liquidation */
export async function incrementLiquidationDownloadCount(liquidationId: string) {
  const supabase = await createClient();
  
  // 1. Fetch current download count
  const { data, error: fetchError } = await supabase
    .from("liquidations")
    .select("download_count")
    .eq("id", liquidationId)
    .single();
    
  if (fetchError) throw fetchError;
  const currentCount = data?.download_count || 0;
  
  // 2. Update with incremented value
  const { error: updateError } = await supabase
    .from("liquidations")
    .update({ download_count: currentCount + 1 })
    .eq("id", liquidationId);
    
  if (updateError) throw updateError;
}

/** Validate payment and generate recouvrement/avis.
 *  NOTE: Role creation is handled atomically inside the SQL RPC (FOR UPDATE lock).
 *  Do NOT call ensureActiveRole here — it would create a race condition
 *  leading to duplicate ACTIF roles for the same commune.
 */
export async function validatePayment(liquidationId: string) {
  const supabase = await createClient();

  const { data: currentLiq } = await supabase
    .from("liquidations")
    .select("reference_liq")
    .eq("id", liquidationId)
    .single();

  const { error, data: result } = await supabase.rpc("valider_paiement_liquidation", {
    p_liquidation_id: liquidationId,
  });
  if (error) throw error;

  // Log de l'action
  await logAction("VALIDATION_PAIEMENT", {
    liquidation_id: liquidationId,
    reference_liq: currentLiq?.reference_liq,
    recouvrement_id: result?.recouvrement_id,
    role_id: result?.role_id,
    commune: result?.commune,
    annee: result?.annee,
  });

  revalidateTag("admin-stats");
  return result;
}

/** Close active role for a commune and create next role */
export async function closeActiveRole(commune: string) {
  const supabase = await createClient();
  const { error, data: result } = await supabase.rpc("cloturer_role_actif", {
    p_commune: commune,
  });
  if (error) throw error;

  // Log de l'action
  await logAction("CLOTURE_ROLE_ACTIF", {
    commune: commune,
    nouveau_numero_role: result?.nouveau_numero_role,
  });

  revalidateTag("admin-stats");
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
  const { data: recouvrementList, error: recouvrementError } = await supabase
    .from("recouvrements")
    .select("id, liquidation_id, role_id, contribuable_id, date_paiement")
    .eq("liquidation_id", liquidationId);

  if (recouvrementError) throw recouvrementError;
  if (!recouvrementList || recouvrementList.length === 0) {
    throw new Error("Avis de recouvrement introuvable pour cette liquidation.");
  }

  const recouvrement = recouvrementList[0];
  const recouvrementIds = recouvrementList.map((r) => r.id);

  const { data: liquidation, error: liquidationError } = await supabase
    .from("liquidations")
    .select("id, reference_liq, superficie, superficie_imposable, valeur_locative, start_year, type_bien, is_loue, valeur_irf, description, commune, arrondissement, quartier, status, created_at")
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
    .select("id, nom_prenoms, ifu_npi, telephone")
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
    .in("recouvrement_id", recouvrementIds)
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
      superficie_imposable: liquidation.superficie_imposable !== null ? Number(liquidation.superficie_imposable) : null,
      valeur_locative: Number(liquidation.valeur_locative) || 0,
      start_year: Number(liquidation.start_year) || getCurrentYear(),
      type_bien: liquidation.type_bien || "NON_BATI",
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
      commune: liquidation.commune || "",
      arrondissement: liquidation.arrondissement || "",
      quartier: liquidation.quartier || "",
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

/** Types pour la couverture de synthèse du rôle */
export interface CouvertureLigneImpot {
  nature_impot: string;
  nb_cotes: number;
  droit_simple: number;
  penalite: number;
  total: number;
}

export interface RoleCouvertureData {
  commune: string;
  numero_role: number;
  annee: number;
  premier_article: number;
  dernier_article: number;
  total_general: number;
  total_droits_simple: number;
  total_penalites: number;
  lignes_impot: CouvertureLigneImpot[];
}

/**
 * Récupère les données agrégées pour générer la couverture de synthèse d'un rôle.
 * Agrège les articles_recouvrement par nature_impot pour chaque rôle.
 */
export async function getRoleCouvertureData(roleId: string): Promise<RoleCouvertureData> {
  const supabase = await createClient();

  // 1. Récupérer les infos du rôle
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, numero_role, commune, annee")
    .eq("id", roleId)
    .single();

  if (roleError || !role) throw new Error("Rôle introuvable.");

  // 2. Récupérer tous les articles liés à ce rôle (via recouvrements)
  const { data: articles, error: articlesError } = await supabase
    .from("articles_recouvrement")
    .select("nature_impot, droit_simple, penalite, numero_article, recouvrement_id")
    .in(
      "recouvrement_id",
      (
        await supabase
          .from("recouvrements")
          .select("id")
          .eq("role_id", roleId)
      ).data?.map((r) => r.id) ?? []
    );

  if (articlesError) throw articlesError;

  const allArticles = articles ?? [];

  // 3. Agréger par nature_impot
  const grouped = new Map<string, CouvertureLigneImpot>();
  let premierArticle = Infinity;
  let dernierArticle = 0;

  for (const art of allArticles) {
    const nature = art.nature_impot || "TFU/FNB";
    const droitSimple = Number(art.droit_simple) || 0;
    const penalite = Number(art.penalite) || 0;
    const numArt = Number(art.numero_article) || 0;

    if (numArt < premierArticle) premierArticle = numArt;
    if (numArt > dernierArticle) dernierArticle = numArt;

    const existing = grouped.get(nature);
    if (existing) {
      existing.nb_cotes += 1;
      existing.droit_simple += droitSimple;
      existing.penalite += penalite;
      existing.total += droitSimple + penalite;
    } else {
      grouped.set(nature, {
        nature_impot: nature,
        nb_cotes: 1,
        droit_simple: droitSimple,
        penalite: penalite,
        total: droitSimple + penalite,
      });
    }
  }

  const lignes_impot = Array.from(grouped.values());
  const total_droits_simple = lignes_impot.reduce((s, l) => s + l.droit_simple, 0);
  const total_penalites = lignes_impot.reduce((s, l) => s + l.penalite, 0);
  const total_general = total_droits_simple + total_penalites;

  return {
    commune: role.commune,
    numero_role: Number(role.numero_role),
    annee: Number(role.annee),
    premier_article: premierArticle === Infinity ? 0 : premierArticle,
    dernier_article: dernierArticle,
    total_general,
    total_droits_simple,
    total_penalites,
    lignes_impot,
  };
}

/** Modifie une liquidation EN_ATTENTE existante */
export async function updateLiquidation(
  liquidationId: string,
  data: TaxpayerInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // 1. Récupérer l'utilisateur courant et son rôle
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: "Vous devez etre authentifie pour modifier une liquidation." };
    }

    const currentRole = await fetchCurrentUserRole();
    const hasExoneration =
      typeof data.superficieImposable === "number" && data.superficieImposable > 0;

    if (hasExoneration && !canApplyExoneration(currentRole)) {
      return { success: false, error: "Exoneration reservee aux inspecteurs et administrateurs." };
    }

    // 2. Vérifier que la liquidation est bien en attente
    const { data: currentLiq, error: getError } = await supabase
      .from("liquidations")
      .select("status, reference_liq, contribuable_id, superficie, superficie_imposable, valeur_locative, start_year, type_bien, contribuable:contribuables(id, nom_prenoms, ifu_npi, commune, arrondissement, quartier)")
      .eq("id", liquidationId)
      .single();

    if (getError || !currentLiq) {
      return { success: false, error: "Liquidation introuvable." };
    }

    if (currentLiq.status !== "EN_ATTENTE") {
      return { success: false, error: "Seules les liquidations en attente peuvent etre modifiees." };
    }

    const superficieImposable = hasExoneration ? data.superficieImposable : null;
    const baseImposable =
      (Number(superficieImposable) || Number(data.superficie) || 0) *
      (Number(data.valeurLocative) || 0);

    // 2.5 Vérifier si le nouvel IFU/NPI est déjà utilisé par un autre contribuable
    const { data: existingContrib } = await supabase
      .from("contribuables")
      .select("id, nom_prenoms")
      .eq("ifu_npi", data.ifuNpi)
      .neq("id", currentLiq.contribuable_id)
      .maybeSingle();

    const oldContribId = currentLiq.contribuable_id;
    let finalContribId = oldContribId;

    if (existingContrib) {
      // Comparer les noms pour s'assurer que c'est la même personne (insensible à la casse, espaces ignorés)
      const cleanName = (n: string) => n.trim().toUpperCase().replace(/\s+/g, " ");
      if (cleanName(existingContrib.nom_prenoms) === cleanName(data.fullname)) {
        // C'est le même contribuable, on va lier cette liquidation à l'existant
        finalContribId = existingContrib.id;
      } else {
        // Noms différents : on l'empêche pour éviter de lier accidentellement à la mauvaise personne
        return { 
          success: false, 
          error: `Cet IFU/NPI est déjà associé au contribuable "${existingContrib.nom_prenoms}" dans le système.` 
        };
      }
    }

    // Si le contribuable actuel est partagé par plusieurs liquidations et que sa localisation a changé,
    // créer/associer un profil distinct pour ne pas impacter les autres liquidations du même contribuable
    const { count: liqCount } = await supabase
      .from("liquidations")
      .select("id", { count: "exact", head: true })
      .eq("contribuable_id", oldContribId);

    const contribData = Array.isArray(currentLiq.contribuable) ? currentLiq.contribuable[0] : currentLiq.contribuable;
    const normNewCommune = normalizeCommune(data.commune);
    const locationChanged = 
      contribData && (
        normalizeCommune(contribData.commune || "") !== normNewCommune ||
        (contribData.arrondissement || "") !== (data.arrondissement || "") ||
        (contribData.quartier || "") !== (data.quartier || "")
      );

    if (finalContribId === oldContribId && liqCount && liqCount > 1 && locationChanged) {
      const { data: contribSameCommune } = await supabase
        .from("contribuables")
        .select("id")
        .eq("ifu_npi", data.ifuNpi)
        .eq("commune", normNewCommune)
        .maybeSingle();

      if (contribSameCommune) {
        finalContribId = contribSameCommune.id;
      } else {
        const { data: newC, error: newCErr } = await supabase
          .from("contribuables")
          .insert({
            nom_prenoms: data.fullname,
            ifu_npi: data.ifuNpi,
            telephone: data.phone === "01" ? null : data.phone,
            commune: normNewCommune,
            arrondissement: data.arrondissement,
            quartier: data.quartier,
          })
          .select("id")
          .single();

        if (newCErr || !newC) {
          return { success: false, error: "Erreur lors de la création du profil contribuable pour la nouvelle commune." };
        }
        finalContribId = newC.id;
      }
    }

    if (finalContribId === oldContribId) {
      // 3. Mettre à jour le contribuable existant
      const { error: contribError } = await supabase
        .from("contribuables")
        .update({
          nom_prenoms: data.fullname,
          ifu_npi: data.ifuNpi,
          telephone: data.phone === "01" ? null : data.phone,
          commune: normalizeCommune(data.commune),
          arrondissement: data.arrondissement,
          quartier: data.quartier,
        })
        .eq("id", oldContribId);

      if (contribError) return { success: false, error: "Erreur lors de la mise a jour du contribuable." };
    } else {
      // Mettre à jour les informations du contribuable cible (au cas où d'autres infos auraient changé)
      await supabase
        .from("contribuables")
        .update({
          telephone: data.phone === "01" ? null : data.phone,
          commune: normalizeCommune(data.commune),
          arrondissement: data.arrondissement,
          quartier: data.quartier,
        })
        .eq("id", finalContribId);
    }

    // 4. Mettre à jour la liquidation (avec le bon finalContribId)
    const { error: liqError } = await supabase
      .from("liquidations")
      .update({
        contribuable_id: finalContribId,
        superficie: Number(data.superficie) || 0,
        superficie_imposable: superficieImposable,
        valeur_locative: Number(data.valeurLocative) || 0,
        start_year: Number(data.startYear) || 2023,
        type_bien: data.typeBien || "NON_BATI",
        base_imposable: baseImposable,
        // Champs Foncier Bâti (FB)
        is_loue: data.typeBien === "BATI" ? (data.isLoue ?? false) : false,
        valeur_irf: data.typeBien === "BATI" && data.isLoue ? (Number(data.valeurIrf) || null) : null,
        description: data.typeBien === "BATI" ? (data.description || null) : null,
        commune: normalizeCommune(data.commune),
        arrondissement: data.arrondissement,
        quartier: data.quartier,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", liquidationId);

    if (liqError) return { success: false, error: "Erreur lors de la mise a jour de la liquidation." };

    // Si on a fusionné/réassocié à un autre contribuable, nettoyer l'ancien contribuable s'il est devenu orphelin
    if (finalContribId !== oldContribId) {
      const { count, error: countError } = await supabase
        .from("liquidations")
        .select("id", { count: "exact", head: true })
        .eq("contribuable_id", oldContribId);

      if (!countError && count === 0) {
        // Aucun autre enregistrement n'utilise ce contribuable, on peut le supprimer
        await supabase
          .from("contribuables")
          .delete()
          .eq("id", oldContribId);
      }
    }

    // 5. Logger l'action
    await logAction("MODIFICATION_LIQUIDATION", {
      reference_liq: currentLiq.reference_liq,
      avant: {
        superficie: currentLiq.superficie,
        superficie_imposable: currentLiq.superficie_imposable,
        valeur_locative: currentLiq.valeur_locative,
        start_year: currentLiq.start_year,
        type_bien: currentLiq.type_bien,
      },
      apres: {
        superficie: data.superficie,
        superficie_imposable: superficieImposable,
        valeur_locative: data.valeurLocative,
        start_year: data.startYear,
        type_bien: data.typeBien,
      },
    });

    revalidateTag("admin-stats");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Une erreur inattendue est survenue." };
  }
}

/** Annule une liquidation EN_ATTENTE */
export async function cancelLiquidation(
  liquidationId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Vous devez etre authentifie pour annuler une liquidation." };
    }

    // 1. Vérifier le statut actuel
    const { data: currentLiq, error: getError } = await supabase
      .from("liquidations")
      .select("status, reference_liq")
      .eq("id", liquidationId)
      .single();

    if (getError || !currentLiq) {
      return { success: false, error: "Liquidation introuvable." };
    }

    if (currentLiq.status !== "EN_ATTENTE") {
      return { success: false, error: "Seules les liquidations en attente peuvent etre annulees." };
    }

    // 2. Mettre à jour la liquidation
    const { error: cancelError } = await supabase
      .from("liquidations")
      .update({
        status: "ANNULE",
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      })
      .eq("id", liquidationId);

    if (cancelError) return { success: false, error: "Erreur lors de l'annulation de la liquidation." };

    // 3. Logger l'action
    await logAction("ANNULATION_LIQUIDATION", {
      reference_liq: currentLiq.reference_liq,
      reason,
    });

    revalidateTag("admin-stats");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Une erreur inattendue est survenue." };
  }
}




