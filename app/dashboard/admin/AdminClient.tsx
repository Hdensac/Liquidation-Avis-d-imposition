"use client";

import React, { useEffect, useState, useTransition } from "react";
import { 
  Users, 
  Terminal, 
  Shield, 
  Search, 
  Clock, 
  Eye, 
  Check, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Loader2,
  Settings,
  Save,
  BarChart3,
  TrendingUp,
  Coins,
  FileText,
  Activity,
  CheckCircle2,
  Download
} from "lucide-react";
import { fetchAuditLogs, fetchAllAuditLogsForExport, updateUserRole, inviteNewAgent, fetchRoleSettings, fetchCommunesWithRoles, saveRoleSetting, fetchAdminStats } from "@/actions/adminActions";
import { generateAuditPdf, summarizeLogDetails } from "@/utils/auditExportUtils";
import type { UserRole } from "@/types/user";
import { COMMUNE_OPTIONS } from "@/components/TaxForm";

type Profile = {
  id: string;
  email: string;
  fullname: string | null;
  role: UserRole | null;
  created_at: string;
};

type AuditLog = {
  id: string;
  user_id: string | null;
  user_email: string;
  action: string;
  details: any;
  created_at: string;
};

interface AdminClientProps {
  initialProfiles: Profile[];
  initialLogs: AuditLog[];
  initialLogTotal: number;
}

const LOGS_PAGE_SIZE = 20;

export default function AdminClient({ initialProfiles, initialLogs, initialLogTotal }: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"stats" | "users" | "logs" | "roleSettings">("stats");
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [logTotal, setLogTotal] = useState(initialLogTotal);
  const [logPage, setLogPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLogsPending, startLogsTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullname, setInviteFullname] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportLogsPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await fetchAllAuditLogsForExport({
        search: logSearch,
        actionFilter,
        dateFilter,
      });
      if (res.success && res.logs && res.logs.length > 0) {
        generateAuditPdf(res.logs, {
          search: logSearch,
          action: actionFilter,
          date: dateFilter,
        });
        setNotification({ type: "success", message: `${res.logs.length} journal(x) d'audit exporté(s) en PDF.` });
      } else {
        setNotification({ type: "error", message: res.error || "Aucun journal à exporter." });
      }
    } catch (err) {
      setNotification({ type: "error", message: "Erreur lors de la génération du PDF d'audit." });
    } finally {
      setIsExportingPdf(false);
      setTimeout(() => setNotification(null), 3500);
    }
  };

  useEffect(() => {
    if (activeTab !== "stats") return;
    
    let isCurrent = true;
    setIsStatsLoading(true);
    
    async function loadStats() {
      try {
        const res = await fetchAdminStats();
        if (isCurrent && res.success) {
          setStats(res.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isCurrent) setIsStatsLoading(false);
      }
    }

    loadStats();

    return () => {
      isCurrent = false;
    };
  }, [activeTab]);

  // Filtrer les profils
  const filteredProfiles = profiles.filter(p => 
    p.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (p.fullname && p.fullname.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // Les logs sont filtres et paginés cote serveur.
  const filteredLogs = logs;
  const totalLogPages = Math.max(1, Math.ceil(logTotal / LOGS_PAGE_SIZE));
  const logStart = logTotal === 0 ? 0 : (logPage - 1) * LOGS_PAGE_SIZE + 1;
  const logEnd = Math.min(logPage * LOGS_PAGE_SIZE, logTotal);

  useEffect(() => {
    let isCurrent = true;

    startLogsTransition(async () => {
      try {
        const result = await fetchAuditLogs({
          page: logPage,
          pageSize: LOGS_PAGE_SIZE,
          search: logSearch,
          actionFilter,
          dateFilter,
        });

        if (isCurrent) {
          setLogs(result.logs);
          setLogTotal(result.total);
        }
      } catch (err) {
        if (isCurrent) {
          setNotification({ type: "error", message: "Erreur lors du chargement des journaux." });
          setTimeout(() => setNotification(null), 3000);
        }
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [logPage, logSearch, actionFilter, dateFilter]);
  // Modifier le rôle d'un utilisateur
  const handleRoleChange = async (userId: string, newRole: UserRole | null) => {
    startTransition(async () => {
      try {
        const res = await updateUserRole(userId, newRole);
        if (res.success) {
          setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
          setNotification({ type: "success", message: "Le rôle a été mis à jour avec succès." });
          setTimeout(() => setNotification(null), 3000);
        }
      } catch (err) {
        setNotification({ type: "error", message: "Erreur lors de la mise à jour du rôle." });
        setTimeout(() => setNotification(null), 3000);
      }
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullname) return;
    setIsInviting(true);
    try {
      const res = await inviteNewAgent(inviteEmail, inviteFullname);
      if (res.success) {
        setNotification({ type: "success", message: "Invitation envoyée avec succès !" });
        setInviteEmail("");
        setInviteFullname("");
        
        // Ajouter temporairement le profil pour feedback visuel immédiat
        const tempId = Math.random().toString();
        setProfiles(prev => [
          {
            id: tempId,
            email: inviteEmail,
            fullname: inviteFullname,
            role: "AGENT",
            created_at: new Date().toISOString()
          },
          ...prev
        ]);
      } else {
        setNotification({ type: "error", message: res.error || "Une erreur est survenue lors de l'invitation." });
      }
    } catch (err) {
      setNotification({ type: "error", message: "Erreur lors de la communication avec le serveur." });
    } finally {
      setIsInviting(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl transition-all duration-300 transform translate-y-0 ${
          notification.type === "success" 
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" 
            : "bg-red-500/15 border-red-500/30 text-red-400"
        }`}>
          {notification.type === "success" ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header Panel (Sleek Navigation Bar) */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="text-indigo-600 dark:text-indigo-400 w-6 h-6" />
          <span className="font-bold text-slate-850 dark:text-slate-100 text-lg">Console Admin</span>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800 self-start md:self-auto flex-wrap gap-1">
          <button
            onClick={() => setActiveTab("stats")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
              activeTab === "stats"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
              activeTab === "users"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            Rôles & Utilisateurs
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
              activeTab === "logs"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Journaux d'Audit
          </button>
          <button
            onClick={() => setActiveTab("roleSettings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
              activeTab === "roleSettings"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Settings className="w-4 h-4" />
            Config Roles
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
        {activeTab === "stats" ? (
          <StatsPanel stats={stats} isLoading={isStatsLoading} />
        ) : activeTab === "users" ? (
          <div>
            {/* Formulaire d'invitation d'agent */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/10">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Inviter un nouvel agent fiscal
              </h2>
              <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Nom complet de l'agent"
                    value={inviteFullname}
                    onChange={(e) => setInviteFullname(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    required
                    placeholder="Adresse email (ex: agent@fisc.bj)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition duration-200 hover:scale-[1.01] active:scale-[0.99] text-sm disabled:opacity-60"
                  >
                    {isInviting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Envoyer l'invitation
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Search and Filters */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par email, nom..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {filteredProfiles.length} utilisateur(s) trouvé(s)
              </div>
            </div>

            {/* Profiles Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/40 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/50">
                    <th className="py-4 px-6">Utilisateur</th>
                    <th className="py-4 px-6">Créé le</th>
                    <th className="py-4 px-6">Rôle Actuel</th>
                    <th className="py-4 px-6 text-right">Actions de Rôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm text-slate-700 dark:text-slate-300">
                  {filteredProfiles.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition duration-150">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {user.fullname || "Sans Nom"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {user.email}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs">
                        {new Date(user.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                          user.role === "ADMIN"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400"
                            : user.role === "INSPECTEUR"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : user.role === "AGENT"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            user.role === "ADMIN" ? "bg-purple-500" : user.role === "INSPECTEUR" ? "bg-emerald-500" : user.role === "AGENT" ? "bg-indigo-500" : "bg-amber-500"
                          }`} />
                          {user.role || "EN ATTENTE"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => handleRoleChange(user.id, "AGENT")}
                            disabled={user.role === "AGENT" || isPending}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              user.role === "AGENT"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-500/30"
                            }`}
                          >
                            Set Agent
                          </button>
                          <button
                            onClick={() => handleRoleChange(user.id, "INSPECTEUR")}
                            disabled={user.role === "INSPECTEUR" || isPending}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              user.role === "INSPECTEUR"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/30"
                            }`}
                          >
                            Set Inspecteur
                          </button>
                          <button
                            onClick={() => handleRoleChange(user.id, "ADMIN")}
                            disabled={user.role === "ADMIN" || isPending}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              user.role === "ADMIN"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                : "bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-500/30"
                            }`}
                          >
                            Set Admin
                          </button>
                          <button
                            onClick={() => handleRoleChange(user.id, null)}
                            disabled={user.role === null || isPending}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                              user.role === null
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                : "bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/30"
                            }`}
                          >
                            Suspendre
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProfiles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Aucun utilisateur trouvé .
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === "logs" ? (
          <div>
            {/* Search and Filters */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-3xl">
                {/* Recherche libre */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher par email, référence, action..."
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value);
                      setLogPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {/* Filtre par Action */}
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">Toutes les actions</option>
                  <option value="CREATION_LIQUIDATION">Création FNB & FB</option>
                  <option value="VALIDATION_PAIEMENT">Paiement FNB & FB</option>
                  <option value="MODIFICATION_FINANCIERE_LIQUIDATION_PAYE">Modification FNB & FB</option>
                  <option value="CREATION_LIQUIDATION_TPS">Création TPS</option>
                  <option value="VALIDATION_PAIEMENT_TPS">Validation TPS</option>
                  <option value="MODIFICATION_FINANCIERE_LIQUIDATION_TPS_VALIDE">Modification TPS</option>
                  <option value="ANNULATION_LIQUIDATION">Annulation Liquidation</option>
                </select>

                {/* Filtre par Période */}
                <select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setLogPage(1);
                  }}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="all">Toutes les dates</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="week">7 derniers jours</option>
                  <option value="month">30 derniers jours</option>
                </select>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                  {isLogsPending ? "Chargement..." : `${logStart}-${logEnd} sur ${logTotal} log(s)`}
                </div>

                {/* Bouton d'exportation PDF */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportLogsPdf}
                    disabled={isExportingPdf || logTotal === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Exporter le journal d'audit filtré au format PDF institutionnel"
                  >
                    {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Logs list */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/40 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/50">
                    <th className="py-4 px-6">Utilisateur</th>
                    <th className="py-4 px-6">Action</th>
                    <th className="py-4 px-6">Référence</th>
                    <th className="py-4 px-6">Description / Détails</th>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm text-slate-700 dark:text-slate-300">
                  {filteredLogs.map((log) => {
                    const ref = log.details?.reference_liq || log.details?.reference_tps;
                    const detailsSummary = summarizeLogDetails(log.details);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition duration-150">
                        <td className="py-4 px-6 font-medium text-slate-900 dark:text-white">
                          {log.user_email}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            log.action === "VALIDATION_PAIEMENT" || log.action === "VALIDATION_PAIEMENT_TPS"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : log.action === "CREATION_LIQUIDATION" || log.action === "CREATION_LIQUIDATION_TPS"
                              ? "bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-400"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-mono text-xs">
                          {ref ? (
                            <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md border border-slate-200/80 dark:border-slate-700/60 inline-block">
                              {ref}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic">—</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-xs text-slate-600 dark:text-slate-300 max-w-xs truncate font-medium" title={detailsSummary}>
                          {detailsSummary}
                        </td>
                        <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(log.created_at).toLocaleString("fr-FR")}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
                            title="Voir la fiche détaillée"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Aucun log d'audit enregistré ou correspondant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {logTotal > 0 && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/60 dark:bg-slate-900/10">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Page {logPage} sur {totalLogPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLogPage((page) => Math.max(1, page - 1))}
                    disabled={logPage === 1 || isLogsPending}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogPage((page) => Math.min(totalLogPages, page + 1))}
                    disabled={logPage >= totalLogPages || isLogsPending}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Suivant
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <RoleSettingsPanel />
        )}
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-lg w-full rounded-2xl shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 border-b border-slate-150 dark:border-slate-750 pb-3">
              <Terminal className="text-indigo-500 w-5 h-5" />
              Détails de l'Action
            </h3>
            
            <div className="space-y-3 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase">Utilisateur</span>
                <span className="text-slate-800 dark:text-slate-200">{selectedLog.user_email}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase">Action</span>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded">{selectedLog.action}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase">Horodatage</span>
                <span className="text-slate-800 dark:text-slate-200">{new Date(selectedLog.created_at).toLocaleString("fr-FR")}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase mb-1">Détails des Modifications</span>
                {selectedLog.details && ((selectedLog.details.data_avant && selectedLog.details.data_apres) || (selectedLog.details.avant && selectedLog.details.apres)) ? (
                  <VisualDiffViewer 
                    before={selectedLog.details.data_avant || selectedLog.details.avant} 
                    after={selectedLog.details.data_apres || selectedLog.details.apres} 
                  />
                ) : (
                  <NonDiffDetailsViewer details={selectedLog.details} />
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => generateAuditPdf([selectedLog])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm transition"
                  title="Exporter ce log en PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm py-2 px-5 rounded-xl transition duration-150"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleSettingsPanel() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [settings, setSettings] = useState<Record<string, number>>({});
  const [communesWithRoles, setCommunesWithRoles] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingCommune, setSavingCommune] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isLoading, startLoadingTransition] = useTransition();

  useEffect(() => {
    let isCurrent = true;
    startLoadingTransition(async () => {
      const [roleSettings, lockedCommunes] = await Promise.all([
        fetchRoleSettings(year),
        fetchCommunesWithRoles(year),
      ]);

      if (!isCurrent) return;

      const nextSettings = Object.fromEntries(
        roleSettings.map((setting) => [setting.commune, Number(setting.initial_numero_role) || 1])
      );
      setSettings(nextSettings);
      setDrafts(Object.fromEntries(Object.entries(nextSettings).map(([commune, value]) => [commune, String(value)])));
      setCommunesWithRoles(lockedCommunes.map((commune) => commune.toUpperCase()));
    });

    return () => {
      isCurrent = false;
    };
  }, [year]);

  const handleSaveSetting = async (commune: string) => {
    const communeUpper = commune.toUpperCase();
    const value = Number(drafts[communeUpper] ?? settings[communeUpper] ?? 1);

    setSavingCommune(communeUpper);
    setMessage(null);
    try {
      const result = await saveRoleSetting(communeUpper, year, value);
      if (!result.success) {
        setMessage({ type: "error", text: result.error || "Enregistrement impossible." });
        return;
      }
      setSettings((prev) => ({ ...prev, [communeUpper]: value }));
      setDrafts((prev) => ({ ...prev, [communeUpper]: String(value) }));
      setMessage({ type: "success", text: `Configuration enregistrée pour ${communeUpper}.` });
    } finally {
      setSavingCommune(null);
      window.setTimeout(() => setMessage(null), 3500);
    }
  };

  return (
    <div>
      <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/20">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Configuration des rôles par commune
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Le numéro initial reste modifiable seulement avant l'émission du premier rôle de la commune pour l'année.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Année
          <input
            type="number"
            min={2023}
            value={year}
            onChange={(event) => setYear(Number(event.target.value) || currentYear)}
            className="w-24 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </label>
      </div>

      {message && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm font-medium ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20"
            : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
        }`}>
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/40 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/50">
              <th className="py-4 px-6">Commune</th>
              <th className="py-4 px-6">Numéro initial</th>
              <th className="py-4 px-6">Statut</th>
              <th className="py-4 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm text-slate-700 dark:text-slate-300">
            {COMMUNE_OPTIONS.map((option) => {
              const commune = option.value.toUpperCase();
              const locked = communesWithRoles.includes(commune);
              const value = drafts[commune] ?? String(settings[commune] ?? 1);
              const isSaving = savingCommune === commune;

              return (
                <tr key={commune} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition duration-150">
                  <td className="py-4 px-6 font-semibold text-slate-900 dark:text-white">{option.label}</td>
                  <td className="py-4 px-6">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={value}
                      disabled={locked || isLoading}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [commune]: event.target.value }))}
                      className="w-28 px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-4 px-6 text-xs">
                    {locked ? (
                      <span className="text-amber-700 dark:text-amber-300 font-medium">
                        Verrouillé : rôle déjà émis pour {year}
                      </span>
                    ) : settings[commune] ? (
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">Configuré </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">Défaut : 1</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      type="button"
                      disabled={locked || isLoading || isSaving}
                      onClick={() => handleSaveSetting(commune)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Enregistrer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VisualDiffViewer({ before, after }: { before: any; after: any }) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") {
    return null;
  }

  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  const fieldLabels: Record<string, string> = {
    fullname: "Nom Complet / Raison Sociale",
    nomRaisonSociale: "Nom Complet / Raison Sociale",
    nom_raison_sociale: "Nom Complet / Raison Sociale",
    ifuNpi: "IFU / NPI",
    ifu_npi: "IFU / NPI",
    ifuNc: "IFU / NPI",
    ifu_nc: "IFU / NPI",
    phone: "Téléphone",
    telephone: "Téléphone",
    commune: "Commune",
    arrondissement: "Arrondissement",
    quartier: "Quartier",
    localisation: "Localisation",
    typeBien: "Type de Bien",
    type_bien: "Type de Bien",
    superficie: "Superficie (m²)",
    superficieImposable: "Superficie Imposable (m²)",
    superficie_imposable: "Superficie Imposable (m²)",
    valeurLocative: "Valeur Locative",
    valeur_locative: "Valeur Locative",
    startYear: "Année de Départ",
    start_year: "Année de Départ",
    isLoue: "Mis en location",
    is_loue: "Mis en location",
    valeurIrf: "Valeur IRF / Micro Foncier",
    valeur_irf: "Valeur IRF / Micro Foncier",
    description: "Description / Détails",
    activite: "Activité principale",
    montantAutresActivites: "Montant Autres Activités",
    montant_autres_activites: "Montant Autres Activités",
    acomptesPayes: "Acomptes Payés",
    acomptes_payes: "Acomptes Payés",
  };

  const formatValue = (val: any) => {
    if (val === undefined || val === null || val === "") return "-";
    if (typeof val === "boolean") return val ? "Oui" : "Non";
    return String(val);
  };

  // Exclude reference keys and unchanged fields
  const changedKeys = allKeys.filter((key) => {
    if (["reference_liq", "reference_tps", "reference", "id", "user_id"].includes(key)) {
      return false;
    }
    const valBefore = before[key];
    const valAfter = after[key];

    const isEmptyBefore = valBefore === undefined || valBefore === null || valBefore === "";
    const isEmptyAfter = valAfter === undefined || valAfter === null || valAfter === "";
    if (isEmptyBefore && isEmptyAfter) return false;

    return JSON.stringify(valBefore) !== JSON.stringify(valAfter);
  });

  if (changedKeys.length === 0) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-center text-xs text-slate-500 italic">
        Aucun champ modifié détecté.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden text-xs">
      <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-900/60 font-semibold p-2.5 border-b border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400">
        <div>Champ Modifié</div>
        <div>Ancienne valeur</div>
        <div>Nouvelle valeur</div>
      </div>
      <div className="divide-y divide-slate-150 dark:divide-slate-700/40 max-h-72 overflow-y-auto">
        {changedKeys.map((key) => {
          const valBefore = before[key];
          const valAfter = after[key];

          return (
            <div 
              key={key} 
              className="grid grid-cols-3 p-2.5 items-center transition duration-150 bg-amber-500/5 dark:bg-amber-500/10 text-slate-900 dark:text-slate-100"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {fieldLabels[key] || key}
              </div>
              <div className="font-mono truncate pr-2 text-rose-600 dark:text-rose-400 font-semibold line-through bg-rose-500/10 px-1.5 py-0.5 rounded">
                {formatValue(valBefore)}
              </div>
              <div className="font-mono truncate text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {formatValue(valAfter)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NonDiffDetailsViewer({ details }: { details: any }) {
  if (!details || typeof details !== "object") {
    return <span className="text-slate-500 italic">—</span>;
  }

  const ignoredKeys = new Set([
    "reference_liq", "reference_tps", "reference", 
    "liquidation_id", "recouvrement_id", "role_id", "user_id"
  ]);

  const entries = Object.entries(details).filter(([key]) => !ignoredKeys.has(key));

  if (entries.length === 0) {
    return (
      <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700/50 text-xs text-slate-500 italic">
        Aucune information supplémentaire.
      </div>
    );
  }

  const labelMap: Record<string, string> = {
    commune: "Commune",
    annee: "Année",
    nouveau_numero_role: "Nouveau N° de Rôle",
    first_article_num: "Premier Article",
    last_article_num: "Dernier Article",
    total_droits: "Total Droits",
    impot_du: "Impôt Dû",
    reason: "Motif",
    contribuable: "Contribuable",
    role: "Rôle",
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700/60 p-3 space-y-2 text-xs">
      {entries.map(([key, val]) => {
        let formattedVal = String(val);
        if (val && typeof val === "object") {
          formattedVal = JSON.stringify(val);
        }
        return (
          <div key={key} className="flex items-center justify-between py-1 border-b border-slate-150 dark:border-slate-800/80 last:border-b-0">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              {labelMap[key] || key}
            </span>
            <span className="font-mono text-slate-800 dark:text-slate-200">
              {formattedVal}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatsPanel({ stats, isLoading }: { stats: any; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="text-sm font-medium animate-pulse">Chargement des statistiques en cours...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-slate-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
        <p>Impossible de charger les statistiques.</p>
      </div>
    );
  }

  const formatFCFA = (val: number) => {
    return new Intl.NumberFormat("fr-FR").format(val) + " F CFA";
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Statistiques Fiscales Globales
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Indicateurs de performance et de volume de liquidation d'imposition sur le territoire.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Recettes FNB / FB */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-slate-900 border border-indigo-100 dark:border-indigo-900/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Recettes FNB & FB</span>
            <Coins className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatFCFA(stats.montantTotalFNB_FB)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-450 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sur {stats.liquidationsPaye} liquidations payées</span>
          </div>
        </div>

        {/* Recettes TPS */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-100 dark:border-emerald-900/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Recettes TPS</span>
            <Coins className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatFCFA(stats.montantTotalTPS)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-450 mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sur {stats.tpsValide} avis TPS validés</span>
          </div>
        </div>

        {/* Contribuables */}
        <div className="bg-gradient-to-br from-sky-50 to-sky-100/30 dark:from-sky-950/20 dark:to-slate-900 border border-sky-100 dark:border-sky-900/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Contribuables</span>
            <Users className="w-5 h-5 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.contribuables}</div>
          <div className="text-xs text-slate-500 dark:text-slate-450 mt-2">
            <span>Enregistrés dans le système</span>
          </div>
        </div>

        {/* Rôles actifs */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-amber-950/20 dark:to-slate-900 border border-amber-100 dark:border-amber-900/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Rôles émis actifs</span>
            <Activity className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.activeRoles}</div>
          <div className="text-xs text-slate-500 dark:text-slate-450 mt-2">
            <span>Rôles en cours de recouvrement</span>
          </div>
        </div>
      </div>

      {/* Ratios et répartition */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* FNB/FB Details */}
        <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-200 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Statut des Liquidations FNB & FB
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">Payées (Recouvrées)</span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold">{stats.liquidationsPaye}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full" 
                  style={{ width: `${(stats.liquidationsPaye + stats.liquidationsAttente) > 0 ? (stats.liquidationsPaye / (stats.liquidationsPaye + stats.liquidationsAttente)) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">En attente de paiement</span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold">{stats.liquidationsAttente}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                <div 
                  className="bg-amber-500 h-2 rounded-full" 
                  style={{ width: `${(stats.liquidationsPaye + stats.liquidationsAttente) > 0 ? (stats.liquidationsAttente / (stats.liquidationsPaye + stats.liquidationsAttente)) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* TPS Details */}
        <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-850 dark:text-slate-200 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" />
            Statut des Liquidations TPS
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">Validées (Emises)</span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold">{stats.tpsValide}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                <div 
                  className="bg-emerald-600 h-2 rounded-full" 
                  style={{ width: `${(stats.tpsValide + stats.tpsAttente) > 0 ? (stats.tpsValide / (stats.tpsValide + stats.tpsAttente)) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-600 dark:text-slate-400">En attente de validation</span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold">{stats.tpsAttente}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                <div 
                  className="bg-amber-500 h-2 rounded-full" 
                  style={{ width: `${(stats.tpsValide + stats.tpsAttente) > 0 ? (stats.tpsAttente / (stats.tpsValide + stats.tpsAttente)) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}