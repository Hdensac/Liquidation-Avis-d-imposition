"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      // Le client Supabase extrait automatiquement les tokens du hash fragment (#access_token=...)
      // et crée la session dans le navigateur.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/dashboard");
      } else {
        // Écouter les changements d'état d'authentification au cas où l'initialisation prend un peu de temps
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
          if (currentSession) {
            router.replace("/dashboard");
          }
        });

        // Sécurité : rediriger vers la connexion après 5 secondes si aucune session n'est détectée
        const timeout = setTimeout(() => {
          router.replace("/login?error=session_timeout");
        }, 5000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timeout);
        };
      }
    };

    checkSession();
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Confirmation de votre invitation...</h2>
        <p className="text-sm text-slate-400">Veuillez patienter pendant que nous configurons votre session sécurisée.</p>
      </div>
    </div>
  );
}
