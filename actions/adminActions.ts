"use server";

import { createClient } from "@/utils/supabase/server";
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

/** Récupère les logs d'audit avec pagination */
export async function fetchAuditLogs() {
  try {
    await ensureAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, user_id, user_email, action, details, created_at")
      .order("created_at", { ascending: false })
      .limit(100); // Limite aux 100 derniers logs pour performance

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erreur fetchAuditLogs:", err);
    throw err;
  }
}
