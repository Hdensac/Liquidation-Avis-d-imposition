"use client";

import React, { useState, useTransition, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { loginWithEmail, signUpWithEmail, signInWithGoogle } from "@/actions/authActions";
import { Lock, Mail, User, ShieldCheck, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

// Sous-composant qui extrait les paramètres d'URL et gère l'UI du formulaire
function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (isSignUp) {
        const res = await signUpWithEmail(formData);
        if (res?.error) {
          setMessage({ type: "error", text: res.error });
        } else if (res?.success) {
          setMessage({ type: "success", text: res.success });
          setIsSignUp(false);
        }
      } else {
        const res = await loginWithEmail(formData);
        if (res?.error) {
          setMessage({ type: "error", text: res.error });
        }
      }
    });
  };

  const handleGoogleSignIn = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await signInWithGoogle();
      if (res?.error) {
        setMessage({ type: "error", text: res.error });
      }
    });
  };

  return (
    <div className="w-full max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8">
      {/* Header Branding */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 mb-4 shadow-inner">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
          Administration Fiscale
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isSignUp ? "Créer un compte agent fiscal" : "Connectez-vous à votre espace agent"}
        </p>
      </div>

      {/* Global URL Error Alert */}
      {urlError === "auth_failed" && !message && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          Échec de l'authentification. Veuillez réessayer.
        </div>
      )}

      {/* Form Response Alert */}
      {message && (
        <div
          className={`mb-6 p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            message.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {message.type === "error" ? (
            <AlertCircle size={16} className="shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Google OAuth Form */}
      <form action={handleGoogleSignIn} className="mb-6">
        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700/80 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] text-sm disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continuer avec Google
        </button>
      </form>

      <div className="relative flex items-center justify-center mb-6">
        <div className="border-t border-gray-200 dark:border-gray-700 w-full"></div>
        <span className="bg-white dark:bg-gray-800 px-3 text-xs text-gray-400 uppercase tracking-widest relative font-medium">
          Ou par Email
        </span>
      </div>

      {/* Email & Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
              Nom complet
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="fullname"
                required
                placeholder="Jean KPANOU"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
            Adresse Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              name="email"
              required
              placeholder="agent@fisc.bj"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              name="password"
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition duration-200 hover:scale-[1.01] active:scale-[0.99] text-sm disabled:opacity-60 mt-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {isSignUp ? "Créer mon compte" : "Se connecter"}
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Toggle Sign In / Sign Up */}
      <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
        {isSignUp ? (
          <>
            Vous avez déjà un compte ?{" "}
            <button
              onClick={() => {
                setIsSignUp(false);
                setMessage(null);
              }}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline ml-1"
            >
              Se connecter
            </button>
          </>
        ) : (
          <>
            Vous n'avez pas de compte agent ?{" "}
            <button
              onClick={() => {
                setIsSignUp(true);
                setMessage(null);
              }}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline ml-1"
            >
              S'inscrire
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Composant de page principal enveloppé dans Suspense
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            Chargement...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}