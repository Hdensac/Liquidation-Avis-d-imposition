import React from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  FilePlus,
  Clock,
  History,
  Briefcase,
  Landmark,
  ShieldCheck,
  UserCheck,
  Activity,
  ChevronRight
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role, email, fullname").eq("id", user.id).single()
    : { data: null };

  const agentName =
    profile?.fullname ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.fullname ||
    user?.user_metadata?.name ||
    user?.email ||
    "Agent fiscal";

  const isAdmin = profile?.role === "ADMIN";

  // Fetch quick metrics for TFU and TPS
  const [
    { count: tfuPendingCount },
    { count: tpsPendingCount }
  ] = await Promise.all([
    supabase.from("liquidations").select("*", { count: "exact", head: true }).eq("statut", "EN_ATTENTE"),
    supabase.from("tps_liquidations").select("*", { count: "exact", head: true }).eq("status", "EN_ATTENTE"),
  ]);

  const currentDateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="space-y-8 pb-8">
      {/* WELCOME BANNER */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 -mb-8 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CIPE-ALLADA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Portail Central de Liquidation
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Bienvenue sur votre espace de gestion des taxes foncières (TFU) et taxes professionnelles (TPS). Sélectionnez un module pour commencer vos travaux.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-1.5 bg-slate-800/60 backdrop-blur-md p-4 rounded-2xl border border-slate-700/60 text-xs">
            <div className="text-slate-400 capitalize">{currentDateStr}</div>
            <div className="font-bold text-slate-100 text-sm">{agentName}</div>
          </div>
        </div>
      </div>

      {/* QUICK STATS & MODULES */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* LEFT COLUMN: STATS */}
        <div className="xl:col-span-1 grid grid-cols-2 xl:grid-cols-1 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">TFU en attente</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{tfuPendingCount || 0}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">TPS en attente</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{tpsPendingCount || 0}</div>
            </div>
          </div>
          <Link href="/dashboard/tfu/new" className="flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition">
            <FilePlus className="w-4 h-4" />
            <span>Module TFU</span>
          </Link>
          <Link href="/dashboard/tps/new" className="flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition">
            <FilePlus className="w-4 h-4" />
            <span>Module TPS</span>
          </Link>
        </div>

        {/* RIGHT COLUMN: MODULE DETAILS */}
        <div className="xl:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* MODULE TFU */}
          <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  MODULE FONCIER
                </span>
                <span className="text-xs font-mono font-semibold text-slate-400">FNB / FB</span>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3.5 bg-indigo-600 text-white rounded-2xl shadow-md">
                  <Landmark className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Taxe Foncière Unique (TFU)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Évaluation foncière, liquidation des parcelles non bâties (FNB) et bâties (FB), gestion des exonérations et rôles de recouvrement.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <Link
                  href="/dashboard/tfu/new"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <FilePlus className="w-4 h-4 text-indigo-600" />
                  <span>Nouvelle fiche</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  href="/dashboard/tfu/pending"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>En attente ({tfuPendingCount || 0})</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  href="/dashboard/tfu/history"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Historique</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  href="/dashboard/tfu/roles"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>Rôles TFU</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>

          {/* MODULE TPS */}
          <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  MODULE PROFESSIONNEL
                </span>
                <span className="text-xs font-mono font-semibold text-slate-400">TPS</span>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-md">
                  <Briefcase className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Taxe Professionnelle Synthétique (TPS)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Déclaration des contribuables synthétiques, calcul du barème ou pourcentage, émission des avis d'imposition et rôles TPS.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <Link
                  href="/dashboard/tps/new"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <FilePlus className="w-4 h-4 text-emerald-600" />
                  <span>Nouvelle fiche TPS</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  href="/dashboard/tps/pending"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>En attente ({tpsPendingCount || 0})</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  href="/dashboard/tps/avis"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <Landmark className="w-4 h-4 text-emerald-600" />
                  <span>Avis validés</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>

                <Link
                  href="/dashboard/tps/roles"
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/70 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-600/80 transition group"
                >
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <span>Rôles TPS</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ADMIN CARD IF USER IS ADMIN */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-purple-900/90 to-indigo-900/90 text-white rounded-3xl p-6 shadow-md border border-purple-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-600/40 rounded-2xl border border-purple-400/30">
              <UserCheck className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <h3 className="font-bold text-base">Espace Administration & Audit</h3>
              <p className="text-xs text-purple-200 mt-0.5">
                Gestion des comptes agents, modification des rôles et exportation des journaux d'audit (PDF/TXT).
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/admin"
            className="shrink-0 px-4 py-2.5 rounded-xl bg-white text-purple-950 hover:bg-purple-100 font-bold text-xs shadow transition flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-purple-700" />
            <span>Accéder à l'Administration</span>
          </Link>
        </div>
      )}
    </div>
  );
}
