"use client";

import React, { useState, useTransition } from "react";
import { 
  Users, 
  Terminal, 
  UserCheck, 
  Shield, 
  RefreshCw, 
  Search, 
  Clock, 
  Eye, 
  Check, 
  AlertCircle
} from "lucide-react";
import { updateUserRole } from "@/actions/adminActions";
import type { UserRole } from "@/types/user";

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
}

export default function AdminClient({ initialProfiles, initialLogs }: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<"users" | "logs">("users");
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [userSearch, setUserSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Filtrer les profils
  const filteredProfiles = profiles.filter(p => 
    p.email.toLowerCase().includes(userSearch.toLowerCase()) || 
    (p.fullname && p.fullname.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // Filtrer les logs
  const filteredLogs = logs.filter(l => 
    l.user_email.toLowerCase().includes(logSearch.toLowerCase()) ||
    l.action.toLowerCase().includes(logSearch.toLowerCase()) ||
    JSON.stringify(l.details || {}).toLowerCase().includes(logSearch.toLowerCase())
  );

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
            Administration Système
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez les autorisations d'accès des utilisateurs et inspectez les actions système.
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
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-hidden">
        {activeTab === "users" ? (
          <div>
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
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            {/* Search and Filters */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par action, email..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {filteredLogs.length} log(s) affiché(s)
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
                    <th className="py-4 px-6 text-right">Détails</th>
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
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Aucun log d'audit enregistré ou correspondant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
                <span className="block text-xs font-semibold text-slate-450 dark:text-slate-400 uppercase mb-1">Données JSON</span>
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
