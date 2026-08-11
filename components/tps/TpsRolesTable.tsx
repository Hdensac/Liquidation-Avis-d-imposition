"use client";

import React, { useCallback, useEffect, useState } from "react";
import { fetchRolesTps, cloturerRoleTps } from "@/actions/tpsActions";
import { useToast, ToastContainer } from "@/components/useToast";
import { Loader2, Lock, ShieldCheck, AlertTriangle } from "lucide-react";

type RoleTps = {
  id: string;
  commune: string;
  annee: number;
  numero_role: number;
  status: string;
  created_at: string;
};

export default function TpsRolesTable() {
  const [roles, setRoles] = useState<RoleTps[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmCommune, setConfirmCommune] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
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

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-800">Rôles d'imposition TPS</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left">Commune</th>
                <th className="px-6 py-4 text-left">Année</th>
                <th className="px-6 py-4 text-left">N° Rôle</th>
                <th className="px-6 py-4 text-left">Statut</th>
                <th className="px-6 py-4 text-left">Date de création</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{role.commune}</td>
                  <td className="px-6 py-4 font-mono">{role.annee}</td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-800">{role.numero_role}</td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {new Date(role.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {role.status === "ACTIF" ? (
                      <button
                        onClick={() => setConfirmCommune(role.commune)}
                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm transition"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Clôturer
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Rôle fermé</span>
                    )}
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">
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
