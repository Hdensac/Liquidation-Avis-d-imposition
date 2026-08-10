"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthConfirmPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleConfirm = async () => {
      try {
        // 1. Essai d'extraction manuelle immédiate du hash fragment
        // Parfois, Next.js ou le cycle de vie React retarde l'auto-détection de Supabase.
        const hash = window.location.hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const tokenType = params.get("type"); // 'invite' pour les invitations, 'recovery' pour reset
          const errorMsg = params.get("error_description") || params.get("error");

          if (errorMsg) {
            router.replace(`/login?error=${encodeURIComponent(errorMsg)}`);
            return;
          }

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error && data.session) {
              // "invite" = nouvel agent invité par l'admin
              // "recovery" = réinitialisation de mot de passe oublié
              // Dans les deux cas on redirige vers set-password
              if (tokenType === "invite" || tokenType === "recovery") {
                router.replace("/auth/set-password");
              } else {
                router.replace("/dashboard");
              }
              return;
            }
          }
        }

        // 2. Fallback sur la détection automatique standard
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace("/dashboard");
          return;
        }

        // 3. Écoute des changements d'état
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
          if (currentSession) {
            router.replace("/dashboard");
          }
        });

        // 4. Redirection en cas de timeout (si le jeton a expiré ou a déjà été consommé)
        const timeout = setTimeout(() => {
          router.replace("/login?error=session_timeout");
        }, 5000);

        return () => {
          subscription.unsubscribe();
          clearTimeout(timeout);
        };
      } catch (err) {
        console.error("Erreur de confirmation d'authentification:", err);
        router.replace("/login?error=confirmation_failed");
      }
    };

    handleConfirm();
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
