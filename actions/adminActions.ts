"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
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
};

/** Récupère les logs d'audit avec pagination */
export async function fetchAuditLogs({
  page = 1,
  pageSize = 20,
  search = "",
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

/** Invite un nouvel agent par e-mail */
export async function inviteNewAgent(email: string, fullname: string) {
  try {
    const adminUser = await ensureAdmin();
    const adminSupabase = createAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

