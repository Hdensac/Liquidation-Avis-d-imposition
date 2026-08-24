"use server";

import { createClient } from "@/utils/supabase/server";

export async function logAction(action: string, details: Record<string, unknown> = {}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email || "",
      action,
      details,
    });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du log d'audit :", error);
  }
}
