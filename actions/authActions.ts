"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithGoogle() {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { url: data.url };
}

export async function signUpWithEmail(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullname = formData.get("fullname") as string;

  if (!email || !password) {
    return { error: "Veuillez renseigner un email et un mot de passe valides." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullname || "",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Inscription réussie ! Vous pouvez maintenant vous connecter." };
}

export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Veuillez renseigner un email et un mot de passe valides." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Supabase retourne "Invalid login credentials" si le compte n'a pas de mot de passe
    // (ex : compte créé uniquement via Google OAuth)
    const isInvalidCredentials =
      error.message.toLowerCase().includes("invalid login credentials") ||
      error.message.toLowerCase().includes("invalid_credentials");

    if (isInvalidCredentials) {
      return {
        error:
          "Identifiants incorrects. Si vous utilisez habituellement Google pour vous connecter, veuillez utiliser le bouton « Continuer avec Google ».",
      };
    }

    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}