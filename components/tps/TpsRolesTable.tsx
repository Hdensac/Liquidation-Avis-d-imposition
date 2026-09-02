"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchRolesTps, cloturerRoleTps, fetchRoleDetailsTps, getRoleCouvertureDataTps } from "@/actions/tpsActions";
import type { RoleSummary } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "@/components/useToast";
import { Loader2, Lock, ShieldCheck, AlertTriangle, ChevronDown, FileText, RefreshCw } from "lucide-react";

type RoleTps = {
  id: string;
  commune: string;
  annee: number;
  numero_role: number;
  status: string;
  created_at: string;
  nb_recouvrements?: number;
  total_droits?: number;
  dernier_article?: number;
};

export default function TpsRolesTable() {
  const [roles, setRoles] = useState<RoleTps[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmCommune, setConfirmCommune] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingCouvertureId, setDownloadingCouvertureId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const { toast, toasts } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRolesTps();
      setRoles((data ?? []) as RoleTps[]);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des rôles TPS.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fermer le menu déroulant si on clique à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCloture = async () => {
    if (!confirmCommune) return;
    setIsClosing(true);
    try {
      const result = await cloturerRoleTps(confirmCommune);
      toast.success(
        `Rôle TPS de ${confirmCommune} clôturé. Nouveau rôle actif : N°${result.nouveau_numero_role}`
      );
      setConfirmCommune(null);
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erreur lors de la clôture du rôle TPS.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleDownloadReport = async (role: RoleTps) => {
    setDownloadingId(role.id);
    try {
      const items = await fetchRoleDetailsTps(role.id);
      const { generateRolePdf } = await import("@/utils/rolePdfGenerator");
      const roleSummary: RoleSummary = {
        id: role.id,
        commune: role.commune,
        annee: role.annee,
        numero_role: role.numero_role,
        status: (role.status === "ACTIF" || role.status === "CLOTURE") ? role.status : "ACTIF",
        created_at: role.created_at,
        nb_recouvrements: role.nb_recouvrements || 0,
        total_droits: role.total_droits || 0,
        dernier_article: role.dernier_article || 0,
      };
      await generateRolePdf(roleSummary, items);
      toast.success(`Rapport du Rôle TPS #${role.numero_role} téléchargé.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors du téléchargement du rapport.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadCouverture = async (role: RoleTps) => {
    setDownloadingCouvertureId(role.id);
    try {
      const data = await getRoleCouvertureDataTps(role.id);
      const { generateCouverturePdf } = await import("@/utils/pdfCouvertureGenerator");
      await generateCouverturePdf(data);
      toast.success(`Couverture du Rôle TPS #${role.numero_role} téléchargée.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors du téléchargement de la couverture.");
    } finally {
      setDownloadingCouvertureId(null);
    }
  };

  const formatCurrency = (amount?: number) => {
    return new Intl.NumberFormat("fr-FR").format(amount || 0) + " FCFA";
  };

  if (loading && roles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement des rôles TPS...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      {/* VUE MOBILE (Cartes) */}
      <div className="md:hidden space-y-3">
        {roles.map((role) => (
          <div key={role.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">{role.commune}</h3>
                <div className="text-xs text-slate-500 font-mono mt-0.5">Année {role.annee}</div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                Rôle #{role.numero_role}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <div>
                {role.status === "ACTIF" ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
                    <Lock className="w-3 h-3" />
                    Clôturé
                  </span>
                )}
              </div>
              <div>Créé le {new Date(role.created_at).toLocaleDateString("fr-FR")}</div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end pt-2 border-t border-slate-100">
              {role.status === "ACTIF" && (
                <button
                  onClick={() => setConfirmCommune(role.commune)}
                  className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-2.5 rounded-lg shadow-sm transition"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Clôturer</span>
                </button>
              )}

              <button
                onClick={() => handleDownloadReport(role)}
                disabled={downloadingId === role.id}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-semibold transition flex items-center gap-1"
              >
                {downloadingId === role.id ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
                <span>Rapport</span>
              </button>

              <button
                onClick={() => handleDownloadCouverture(role)}
                disabled={downloadingCouvertureId === role.id}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-semibold transition flex items-center gap-1"
              >
                {downloadingCouvertureId === role.id ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <span className="text-sm">📑</span>
                )}
                <span>Couverture</span>
              </button>
            </div>
          </div>
        ))}
        {roles.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
            Aucun rôle TPS. Les rôles sont créés automatiquement lors de la première validation d'un avis.
          </div>
        )}
      </div>

      {/* VUE DESKTOP (Tableau) */}
      <div className="hidden md:block bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden min-h-[220px]">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Rôles d'imposition TPS</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 text-left">Commune</th>
                <th className="px-5 py-4 text-left">Année</th>
                <th className="px-5 py-4 text-left">N° Rôle</th>
                <th className="px-5 py-4 text-left">Statut</th>
                <th className="px-5 py-4 text-right">Avis Émis</th>
                <th className="px-5 py-4 text-right">Dernier Art.</th>
                <th className="px-5 py-4 text-right">Total Droits</th>
                <th className="px-5 py-4 text-left">Date de création</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {roles.map((role, index) => {
                const isNearBottom = index >= roles.length - 2 && roles.length > 2 && index >= 2;
                const menuPositionClass = isNearBottom
                  ? "bottom-full mb-1.5 animate-in fade-in slide-in-from-bottom-2"
                  : "top-full mt-1.5 animate-in fade-in slide-in-from-top-2";

                return (
                  <tr key={role.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-semibold text-slate-900">{role.commune}</td>
                    <td className="px-5 py-4 font-mono">{role.annee}</td>
                    <td className="px-5 py-4 font-mono font-bold text-indigo-600">#{role.numero_role}</td>
                    <td className="px-5 py-4">
                      {role.status === "ACTIF" ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200">
                          <Lock className="w-3 h-3" />
                          Clôturé
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums font-medium">{role.nb_recouvrements ?? 0}</td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      {role.dernier_article && role.dernier_article > 0 ? "#" + role.dernier_article : "-"}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums font-medium">
                      {formatCurrency(role.total_droits)}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(role.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2" ref={openDropdownId === role.id ? dropdownRef : null}>
                        {role.status === "ACTIF" && (
                          <button
                            onClick={() => setConfirmCommune(role.commune)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 font-medium transition inline-flex items-center gap-1"
                            title="Clôturer ce rôle actif"
                          >
                            <Lock size={12} />
                            <span>Clôture</span>
                          </button>
                        )}

                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === role.id ? null : role.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition inline-flex items-center gap-1.5"
                            aria-haspopup="true"
                            aria-expanded={openDropdownId === role.id}
                          >
                            <span>Documents</span>
                            <ChevronDown size={13} className={`transition-transform duration-200 ${openDropdownId === role.id ? "rotate-180" : ""}`} />
                          </button>

                          {openDropdownId === role.id && (
                            <div className={`absolute right-0 ${menuPositionClass} w-52 rounded-xl border border-slate-200 bg-white shadow-xl py-1 z-50 text-left duration-150`}>
                              <div className="px-3 py-1.5 border-b border-slate-100">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Exports PDF</p>
                              </div>
                              <div className="p-1">
                                <button
                                  onClick={() => { handleDownloadReport(role); setOpenDropdownId(null); }}
                                  disabled={downloadingId === role.id}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition"
                                >
                                  {downloadingId === role.id ? (
                                    <RefreshCw size={14} className="animate-spin text-indigo-500" />
                                  ) : (
                                    <FileText size={14} className="text-indigo-500" />
                                  )}
                                  <span>Rapport du Rôle</span>
                                </button>

                                <button
                                  onClick={() => { handleDownloadCouverture(role); setOpenDropdownId(null); }}
                                  disabled={downloadingCouvertureId === role.id}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition"
                                >
                                  {downloadingCouvertureId === role.id ? (
                                    <RefreshCw size={14} className="animate-spin text-emerald-500" />
                                  ) : (
                                    <span className="text-sm">📑</span>
                                  )}
                                  <span>État de Couverture</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-slate-400 italic">
                    Aucun rôle TPS. Les rôles sont créés automatiquement lors de la première validation d'un avis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CONFIRMATION DE CLOTURE */}
      {confirmCommune && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Clôturer le rôle TPS de {confirmCommune}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              La clôture du rôle actif de <strong>{confirmCommune}</strong> est{" "}
              <strong className="text-red-600">irréversible</strong>. Un nouveau rôle sera automatiquement
              créé avec un numéro incrémenté. Les numéros d'articles du prochain rôle reprendront à 1.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCommune(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCloture}
                disabled={isClosing}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
              >
                {isClosing ? "Clôture en cours..." : "Confirmer la clôture"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
