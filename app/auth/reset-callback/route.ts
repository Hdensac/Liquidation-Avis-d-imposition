// app/auth/reset-callback/route.ts
// Route dédiée au flow PKCE de réinitialisation de mot de passe.
// Supabase envoie un ?code= en query param (pas un hash fragment).
// On échange ce code contre une session, puis on redirige vers set-password.

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Session valide → on force la redirection vers la page de définition du mdp
      return NextResponse.redirect(`${origin}/auth/set-password`);
    }

    console.error("Erreur reset-callback exchangeCodeForSession:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Lien invalide ou expiré. Veuillez faire une nouvelle demande.")}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Lien de réinitialisation invalide.")}`
  );
}
