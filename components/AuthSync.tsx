"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthSync() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Définir un cookie contenant le token d'authentification
        const maxAge = session.expires_in ? `; max-age=${session.expires_in}` : "";
        document.cookie = `sb-auth-token=${encodeURIComponent(session.access_token)}; path=/${maxAge}; SameSite=Lax; Secure`;
      } else {
        // Supprimer le cookie lors de la déconnexion
        document.cookie = "sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
