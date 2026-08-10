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
  Save
} from "lucide-react";
import { fetchAuditLogs, updateUserRole, inviteNewAgent, fetchRoleSettings, fetchCommunesWithRoles, saveRoleSetting } from "@/actions/adminActions";
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
  const [activeTab, setActiveTab] = useState<"users" | "logs" | "roleSettings">("users");
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [logTotal, setLogTotal] = useState(initialLogTotal);
  const [logPage, setLogPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLogsPending, startLogsTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullname, setInviteFullname] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  // Filtrer les profils
  const filteredProfiles = profiles.filter(p => 
    p.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (p.fullname && p.fullname.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // Les logs sont filtrï¿½s et paginï¿½s cï¿½tï¿½ serveur.
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
  }, [logPage, logSearch]);
  // Modifier le rÃ´le d'un utilisateur
  const handleRoleChange = async (userId: string, newRole: UserRole | null) => {
    startTransition(async () => {
      try {
        const res = await updateUserRole(userId, newRole);
        if (res.success) {
          setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
          setNotification({ type: "success", message: "Le rÃ´le a Ã©tÃ© mis Ã  jour avec succÃ¨s." });
          setTimeout(() => setNotification(null), 3000);
        }
      } catch (err) {
        setNotification({ type: "error", message: "Erreur lors de la mise Ã  jour du rÃ´le." });
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
        setNotification({ type: "success", message: "Invitation envoyÃ©e avec succÃ¨s !" });
        setInviteEmail("");
        setInviteFullname("");
        
        // Ajouter temporairement le profil pour feedback visuel immÃ©diat
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

      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Shield className="text-indigo-600 dark:text-indigo-400 w-7 h-7" />
            Administration SystÃ¨me
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            GÃ©rez les autorisations d'accÃ¨s des utilisateurs et inspectez les actions systÃ¨me.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition duration-200 ${
              activeTab === "users"
                ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            RÃ´les & Utilisateurs
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
            Config Rôles
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
        {activeTab === "users" ? (
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
                {filteredProfiles.length} utilisateur(s) trouvÃ©(s)
              </div>
            </div>

            {/* Profiles Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/40 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/50">
                    <th className="py-4 px-6">Utilisateur</th>
                    <th className="py-4 px-6">CrÃ©Ã© le</th>
                    <th className="py-4 px-6">RÃ´le Actuel</th>
                    <th className="py-4 px-6 text-right">Actions de RÃ´le</th>
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
                        Aucun utilisateur trouvÃ©.
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
            <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par action, email..."
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isLogsPending ? "Chargement..." : `${logStart}-${logEnd} sur ${logTotal} log(s)`}
              </div>
            </div>

            {/* Audit Logs list */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/40 dark:bg-slate-900/30 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/50">
                    <th className="py-4 px-6">Utilisateur</th>
                    <th className="py-4 px-6">Action</th>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6 text-right">DÃ©tails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 text-sm text-slate-700 dark:text-slate-300">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition duration-150">
                      <td className="py-4 px-6 font-medium text-slate-900 dark:text-white">
                        {log.user_email}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          log.action === "VALIDATION_PAIEMENT"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : log.action === "CREATION_LIQUIDATION"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(log.created_at).toLocaleString("fr-FR")}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 hover:bg-slate-150 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
                          title="Voir les dÃ©tails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Aucun log d'audit enregistrÃ© ou correspondant.
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
                    PrÃ©cÃ©dent
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
              DÃ©tails de l'Action
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
                <span className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase mb-1">DonnÃ©es JSON</span>
                <pre className="bg-slate-900 text-amber-400 font-mono text-xs p-4 rounded-xl overflow-x-auto border border-slate-850 max-h-60">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
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
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">Configuré</span>
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