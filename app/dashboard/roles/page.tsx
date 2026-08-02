"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchAllRoles, closeActiveRole, fetchRoleDetails } from "../../../actions/liquidationActions";
import type { RoleSummary } from "../../../actions/liquidationActions";
import { useToast, ToastContainer } from "../../../components/useToast";
import { Briefcase, CheckCircle, Lock, RefreshCw, AlertTriangle, FileText } from "lucide-react";
//import { generateRolePdf } from "../../../lib/generateRolePdf"; // Ajuste le chemin selon ton projet
import { generateRolePdf } from "@/utils/rolePdfGenerator";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: "ACTIF" | "CLOTURE" }) {
  if (status === "ACTIF") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
        <CheckCircle size={11} /> ACTIF
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
      <Lock size={11} /> CLOTURE
    </span>
  );
}

function ConfirmCloseModal({
  role,
  onConfirm,
  onCancel,
  loading,
}: {
  role: RoleSummary;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
            <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Cloture du Role #{role.numero_role}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          Vous etes sur le point de cloturer le role actif de la commune de{" "}
          <strong>{role.commune}</strong> ({role.annee}).
        </p>
        <ul className="text-sm text-gray-600 dark:text-gray-300 mb-4 list-disc list-inside space-y-1">
          <li>{role.nb_recouvrements} avis de recouvrement enregistres</li>
          <li>Dernier article : #{role.dernier_article}</li>
          <li>Un nouveau Role #{role.numero_role + 1} sera cree automatiquement</li>
          <li className="text-red-500 font-medium">Cette action est irreversible</li>
        </ul>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition flex items-center gap-2"
          >
            {loading && <RefreshCw size={13} className="animate-spin" />}
            Confirmer la cloture
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [closeTarget, setCloseTarget] = useState<RoleSummary | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast, toasts } = useToast();

  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let cancelled = false;
    setPageLoading(true);
    fetchAllRoles()
      .then((data) => { if (!cancelled) setRoles(data); })
      .catch(() => { if (!cancelled) toastRef.current.error("Impossible de charger les roles."); })
      .finally(() => { if (!cancelled) setPageLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const load = () => setRefreshKey((k) => k + 1);

  const handleConfirmClose = async () => {
    if (!closeTarget) return;
    setCloseLoading(true);
    try {
      const result = await closeActiveRole(closeTarget.commune);
      const newNum = (result as { numero_role?: number })?.numero_role ?? closeTarget.numero_role + 1;
      toast.success("Role #" + closeTarget.numero_role + " cloture. Nouveau role actif : #" + newNum);
      setCloseTarget(null);
      load();
    } catch {
      toast.error("Echec de la cloture du role.");
    } finally {
      setCloseLoading(false);
    }
  };

  const handleDownloadReport = async (role: RoleSummary) => {
    setDownloadingId(role.id);
    try {
      const details = await fetchRoleDetails(role.id);
      generateRolePdf(role, details);
      toast.success(`Rapport du Rôle #${role.numero_role} téléchargé.`);
    } catch {
      toast.error("Échec du téléchargement du rapport.");
    } finally {
      setDownloadingId(null);
    }
  };

  // --- CALCULS METIER POUR LES STATS ---
  const totalDroits = roles.reduce((s, r) => s + r.total_droits, 0);
  const totalAvis = roles.reduce((s, r) => s + r.nb_recouvrements, 0);
  const nbActifs = roles.filter((r) => r.status === "ACTIF").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
          <Briefcase size={22} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Gestion des Roles</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Suivi et cloture des roles de recouvrement
          </p>
        </div>
        <button
          onClick={load}
          className="ml-auto p-2 rounded-lg bg-white dark:bg-gray-800 shadow hover:shadow-md transition"
          title="Actualiser"
        >
          <RefreshCw
            size={15}
            className={pageLoading ? "animate-spin text-indigo-500" : "text-gray-500"}
          />
        </button>
      </div>

      {/* --- CARTES DE STATISTIQUES --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border-l-4 border-indigo-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 font-semibold">
            Rôles en cours
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {nbActifs} {nbActifs > 1 ? "actifs" : "actif"}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              / {roles.length} enregistrés
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border-l-4 border-purple-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 font-semibold">
            Total avis emis
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{totalAvis}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border-l-4 border-emerald-500">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 font-semibold">
            Total droits (XOF)
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalDroits)}</p>
        </div>
      </div>

      {/* --- TABLEAU DES ROLES --- */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow overflow-hidden">
        {pageLoading ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-indigo-400" />
            Chargement des roles...
          </div>
        ) : roles.length === 0 ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            Aucun role disponible pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3">N Role</th>
                  <th className="px-5 py-3">Commune</th>
                  <th className="px-5 py-3">Annee</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Avis emis</th>
                  <th className="px-5 py-3 text-right">Dernier art.</th>
                  <th className="px-5 py-3 text-right">Total droits</th>
                  <th className="px-5 py-3">Cree le</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {roles.map((role) => (
                  <tr
                    key={role.id}
                    className="hover:bg-indigo-50/40 dark:hover:bg-gray-700/30 transition"
                  >
                    <td className="px-5 py-4 font-bold text-indigo-600 dark:text-indigo-400">
                      #{role.numero_role}
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-800 dark:text-gray-200">
                      {role.commune}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{role.annee}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={role.status} />
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{role.nb_recouvrements}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {role.dernier_article > 0 ? "#" + role.dernier_article : "-"}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums font-medium">
                      {formatCurrency(role.total_droits)}
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(role.created_at)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {role.status === "ACTIF" ? (
                        <button
                          onClick={() => setCloseTarget(role)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-medium transition"
                        >
                          Cloture
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownloadReport(role)}
                          disabled={downloadingId === role.id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 font-medium transition inline-flex items-center gap-1.5"
                        >
                          {downloadingId === role.id ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <FileText size={12} />
                          )}
                          Rapport PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {closeTarget && (
        <ConfirmCloseModal
          role={closeTarget}
          onConfirm={handleConfirmClose}
          onCancel={() => setCloseTarget(null)}
          loading={closeLoading}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}