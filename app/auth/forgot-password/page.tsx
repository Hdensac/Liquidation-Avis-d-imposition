"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/authActions";
import {
  Mail,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await requestPasswordReset(formData);
      if (res?.error) {
        setMessage({ type: "error", text: res.error });
      } else if (res?.success) {
        setMessage({ type: "success", text: res.success });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-12">
      <div className="w-full max-w-md bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-700/50 p-8 animate-fade-in">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 mb-4 shadow-inner">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
            Mot de passe oublié
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Renseignez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {/* Alert */}
        {message && (
          <div
            className={`mb-6 p-3.5 rounded-xl text-xs flex items-start gap-2 border ${
              message.type === "error"
                ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {message.type === "error" ? (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Formulaire — masqué après succès */}
        {!message || message.type === "error" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition duration-200 hover:scale-[1.01] active:scale-[0.99] text-sm disabled:opacity-60 mt-2"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Envoyer le lien de réinitialisation"
              )}
            </button>
          </form>
        ) : null}

        {/* Lien retour */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition font-medium"
          >
            <ArrowLeft size={13} />
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
