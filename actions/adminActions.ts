"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath, unstable_cache } from "next/cache";
import type { UserRole } from "@/types/user";


/** Vérifie si l'utilisateur actuellement connecté est ADMIN */
async function ensureAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "ADMIN") {
    throw new Error("Accès interdit : rôle administrateur requis");
  }
  return user;
}

/** Récupère la liste de tous les profils utilisateurs */
export async function fetchProfiles() {
  try {
    await ensureAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, fullname, role, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erreur fetchProfiles:", err);
    throw err;
  }
}

/** Met à jour le rôle d'un utilisateur */
export async function updateUserRole(userId: string, role: UserRole | null) {
  try {
    await ensureAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (error) throw error;
    
    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (err) {
    console.error("Erreur updateUserRole:", err);
    throw err;
  }
}

type FetchAuditLogsParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  actionFilter?: string;
  dateFilter?: string;
};

/** Récupère les logs d'audit avec pagination */
export async function fetchAuditLogs({
  page = 1,
  pageSize = 20,
  search = "",
  actionFilter = "",
  dateFilter = "all",
}: FetchAuditLogsParams = {}) {
  try {
    await ensureAdmin();
    const supabase = await createClient();
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 100);
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;
    const normalizedSearch = search.trim().replace(/[%,()]/g, " ").trim();

    let query = supabase
      .from("audit_logs")
      .select("id, user_id, user_email, action, details, created_at", { count: "exact" });

    if (normalizedSearch) {
      query = query.or(`user_email.ilike.%${normalizedSearch}%,action.ilike.%${normalizedSearch}%`);
    }

    if (actionFilter) {
      query = query.eq("action", actionFilter);
    }

    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      if (dateFilter === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte("created_at", startOfToday);
      } else if (dateFilter === "week") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", oneWeekAgo);
      } else if (dateFilter === "month") {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", oneMonthAgo);
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      logs: data || [],
      total: count || 0,
    };
  } catch (err) {
    console.error("Erreur fetchAuditLogs:", err);
    throw err;
  }
}

/** Récupère tous les logs d'audit correspondant aux filtres actuels pour l'export */
export async function fetchAllAuditLogsForExport({
  search = "",
  actionFilter = "",
  dateFilter = "all",
}: { search?: string; actionFilter?: string; dateFilter?: string } = {}) {
  try {
    await ensureAdmin();
    const supabase = await createClient();
    const normalizedSearch = search.trim().replace(/[%,()]/g, " ").trim();

    let query = supabase
      .from("audit_logs")
      .select("id, user_id, user_email, action, details, created_at");

    if (normalizedSearch) {
      query = query.or(`user_email.ilike.%${normalizedSearch}%,action.ilike.%${normalizedSearch}%`);
    }

    if (actionFilter) {
      query = query.eq("action", actionFilter);
    }

    if (dateFilter && dateFilter !== "all") {
      const now = new Date();
      if (dateFilter === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte("created_at", startOfToday);
      } else if (dateFilter === "week") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", oneWeekAgo);
      } else if (dateFilter === "month") {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", oneMonthAgo);
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false }).limit(5000);

    if (error) throw error;
    return { success: true, logs: data || [] };
  } catch (err: any) {
    console.error("Erreur fetchAllAuditLogsForExport:", err);
    return { success: false, error: err.message || "Erreur lors de la récupération des logs pour l'export.", logs: [] };
  }
}

import { headers } from "next/headers";

/** Invite un nouvel agent par e-mail */
export async function inviteNewAgent(email: string, fullname: string) {
  try {
    const adminUser = await ensureAdmin();
    const adminSupabase = createAdminClient();
    
    // Détecter dynamiquement l'URL du site en fonction de la requête courante
    const headersList = headers();
    const host = headersList.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    const siteUrl = `${protocol}://${host}`;

    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm`,
      data: {
        full_name: fullname || "",
      },
    });

    if (error) throw error;

    // Le trigger handle_new_user va automatiquement créer une ligne dans profiles.
    // Mettons à jour le rôle de cet utilisateur à 'AGENT' par défaut immédiatement.
    if (data?.user?.id) {
      const supabase = await createClient();
      await supabase
        .from("profiles")
        .update({ role: "AGENT" })
        .eq("id", data.user.id);
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Erreur inviteNewAgent:", err);
    return { error: err.message || "Une erreur est survenue lors de l'invitation." };
  }
}

// ====================================================================
// Configuration du numéro de départ des rôles par commune et par année
// ====================================================================

export type RoleSetting = {
  commune: string;
  annee: number;
  initial_numero_role: number;
  created_at: string;
  updated_at: string;
};

/** Récupère les configurations de départ pour une année donnée */
export async function fetchRoleSettings(annee: number): Promise<RoleSetting[]> {
  try {
    await ensureAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("role_commune_settings")
      .select("*")
      .eq("annee", annee)
      .order("commune", { ascending: true });

    if (error) throw error;
    return (data ?? []) as RoleSetting[];
  } catch (err: any) {
    console.error("Erreur fetchRoleSettings:", err);
    return [];
  }
}

/** Récupère les communes qui ont déjà au moins un rôle pour une année donnée */
export async function fetchCommunesWithRoles(annee: number): Promise<string[]> {
  try {
    await ensureAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("roles")
      .select("commune")
      .eq("annee", annee);

    if (error) throw error;
    // Extraire les communes uniques
    const communes = Array.from(new Set((data ?? []).map((r: { commune: string }) => r.commune)));
    return communes;
  } catch (err: any) {
    console.error("Erreur fetchCommunesWithRoles:", err);
    return [];
  }
}

/** Enregistre ou met à jour le numéro de départ d'une commune pour une année */
export async function saveRoleSetting(
  commune: string,
  annee: number,
  initialRoleNumber: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAdmin();
    const supabase = await createClient();

    if (initialRoleNumber < 1 || !Number.isInteger(initialRoleNumber)) {
      return { success: false, error: "Le numero de depart doit etre un entier positif (minimum 1)." };
    }

    const communeUpper = commune.toUpperCase();

    const { error } = await supabase
      .from("role_commune_settings")
      .upsert(
        {
          commune: communeUpper,
          annee,
          initial_numero_role: initialRoleNumber,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "commune,annee" }
      );

    if (error) {
      // Le trigger SQL bloquera si des rôles existent déjà
      if (error.message?.includes("des roles existent deja")) {
        return { success: false, error: "Impossible de modifier : des roles ont deja ete emis pour cette commune et cette annee." };
      }
      return { success: false, error: error.message || "Erreur lors de l'enregistrement." };
    }

    revalidatePath("/dashboard/admin");
    return { success: true };
  } catch (err: any) {
    console.error("Erreur saveRoleSetting:", err);
    return { success: false, error: err.message || "Une erreur inattendue est survenue." };
  }
}

const getCachedAdminStats = unstable_cache(
  async () => {
    const supabase = createAdminClient();

    // Lancer les requêtes en parallèle pour optimiser les performances
    const [
      { count: totalLiqPayeCount },
      { count: totalLiqAttenteCount },
      { count: totalTpsValideCount },
      { count: totalTpsAttenteCount },
      { count: totalContribCount },
      { count: totalTpsContribCount },
      { count: activeRolesCount },
      { data: liqPayeAmounts },
      { data: tpsValideAmounts }
    ] = await Promise.all([
      supabase.from("liquidations").select("id", { count: "exact", head: true }).eq("status", "PAYE"),
      supabase.from("liquidations").select("id", { count: "exact", head: true }).eq("status", "EN_ATTENTE"),
      supabase.from("tps_liquidations").select("id", { count: "exact", head: true }).eq("status", "VALIDE"),
      supabase.from("tps_liquidations").select("id", { count: "exact", head: true }).eq("status", "EN_ATTENTE"),
      supabase.from("contribuables").select("id", { count: "exact", head: true }),
      supabase.from("tps_contribuables").select("id", { count: "exact", head: true }),
      supabase.from("roles").select("id", { count: "exact", head: true }).eq("status", "ACTIF"),
      supabase.from("liquidations").select("base_imposable").eq("status", "PAYE"),
      supabase.from("tps_liquidations").select("impot_du").eq("status", "VALIDE")
    ]);

    const sumLiqPaye = liqPayeAmounts?.reduce((sum, item) => sum + (Number(item.base_imposable) || 0), 0) || 0;
    const sumTpsValide = tpsValideAmounts?.reduce((sum, item) => sum + (Number(item.impot_du) || 0), 0) || 0;

    return {
      liquidationsPaye: totalLiqPayeCount || 0,
      liquidationsAttente: totalLiqAttenteCount || 0,
      tpsValide: totalTpsValideCount || 0,
      tpsAttente: totalTpsAttenteCount || 0,
      contribuables: (totalContribCount || 0) + (totalTpsContribCount || 0),
      activeRoles: activeRolesCount || 0,
      montantTotalFNB_FB: sumLiqPaye,
      montantTotalTPS: sumTpsValide
    };
  },
  ["admin-stats"],
  {
    revalidate: 300, // Cache de 5 minutes
    tags: ["admin-stats"]
  }
);

/** Récupère les statistiques globales pour le dashboard admin */
export async function fetchAdminStats() {
  try {
    await ensureAdmin();
    const stats = await getCachedAdminStats();
    return {
      success: true,
      stats
    };
  } catch (err: any) {
    console.error("Erreur fetchAdminStats:", err);
    return { success: false, error: err.message || "Impossible de charger les statistiques." };
  }
}
