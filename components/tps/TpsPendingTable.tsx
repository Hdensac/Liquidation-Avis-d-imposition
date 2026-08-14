"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  fetchPendingLiquidationsTps,
  validerPaiementTps,
  updateLiquidationTps,
  cancelLiquidationTps,
  fetchRolesTps
} from "@/actions/tpsActions";
import { useToast, ToastContainer } from "@/components/useToast";
import { TpsForm } from "./TpsForm";
import { TpsInput } from "@/utils/tpsCalculations";
import { FileText, Loader2, Search, X, Edit, Trash2, AlertTriangle, CheckSquare } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

type Contribuable = {
  id: string;
  nom_raison_sociale: string;
  ifu_nc: string;
  telephone: string;
  commune: string;
  arrondissement: string;
  quartier: string;
  localisation: string;
};

type LiquidationTps = {
  id: string;
  reference_tps: string;
  status: string;
  created_at: string;
  activite: string;
  montant_autres_activites: number;
  tps_calcule: number;
  portb: number;
  impot_du: number;
  acomptes_payes: number;
  reste_du: number;
  start_year: number;
  contribuable: Contribuable;
};

export default function TpsPendingTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [liquidations, setLiquidations] = useState<LiquidationTps[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast, toasts } = useToast();

  // Modal States
  const [selectedLiquidation, setSelectedLiquidation] = useState<LiquidationTps | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isValidateOpen, setIsValidateOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<TpsInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeRolesTps, setActiveRolesTps] = useState<any[]>([]);

  // Charger les rôles TPS actifs pour l'avertissement de limite d'articles
  useEffect(() => {
    fetchRolesTps()
      .then((roles) => setActiveRolesTps((roles as any[]).filter((r) => r.status === "ACTIF")))
      .catch(console.error);
  }, []);

  const loadData = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const { data, totalCount: total } = await fetchPendingLiquidationsTps({ page });
        setLiquidations((data ?? []) as LiquidationTps[]);
        setTotalCount(total);
      } catch (e) {
        console.error(e);
        toast.error("Erreur lors du chargement des liquidations TPS en attente.");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadData(currentPage);
  }, [currentPage, loadData]);

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
    setSearchQuery("");
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (currentPage !== 1) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const filteredLiquidations = useMemo(() => {
    if (!searchQuery.trim()) return liquidations;
    const q = searchQuery.toLowerCase().trim();
    return liquidations.filter((liq) => {
      const nom = (liq.contribuable?.nom_raison_sociale || "").toLowerCase();
      const ifu = (liq.contribuable?.ifu_nc || "").toLowerCase();
      const ref = (liq.reference_tps || "").toLowerCase();
      return nom.includes(q) || ifu.includes(q) || ref.includes(q);
    });
  }, [liquidations, searchQuery]);

  const handleOpenEdit = (liq: LiquidationTps) => {
    setSelectedLiquidation(liq);
    setEditFormData({
      nomRaisonSociale: liq.contribuable.nom_raison_sociale,
      ifuNc: liq.contribuable.ifu_nc,
      telephone: liq.contribuable.telephone || "",
      commune: liq.contribuable.commune,
      arrondissement: liq.contribuable.arrondissement,
      quartier: liq.contribuable.quartier,
      localisation: liq.contribuable.localisation || "",
      activite: liq.activite,
      montantAutresActivites: Number(liq.montant_autres_activites),
      acomptesPayes: Number(liq.acomptes_payes),
      startYear: liq.start_year,
    });
    setErrorMsg(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedLiquidation || !editFormData) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await updateLiquidationTps(selectedLiquidation.id, editFormData);
      toast.success("Fiche TPS modifiée avec succès.");
      setIsEditOpen(false);
      loadData(currentPage);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erreur lors de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCancel = (liq: LiquidationTps) => {
    setSelectedLiquidation(liq);
    setIsCancelOpen(true);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiquidation) return;
    setIsSaving(true);
    try {
      await cancelLiquidationTps(selectedLiquidation.id);
      toast.success("Fiche TPS annulée avec succès.");
      setIsCancelOpen(false);
      loadData(currentPage);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'annulation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenValidate = (liq: LiquidationTps) => {
    setSelectedLiquidation(liq);
    setIsValidateOpen(true);
  };

  const handleValidateConfirm = async () => {
    if (!selectedLiquidation) return;
    setIsSaving(true);
    try {
      const result = await validerPaiementTps(selectedLiquidation.id);
      toast.success(
        `Fiche TPS validée ! Articles générés : ${result.first_article_num} et ${result.last_article_num}`
      );
      setIsValidateOpen(false);
      // Recharger les rôles TPS actifs après validation
      fetchRolesTps()
        .then((roles) => setActiveRolesTps((roles as any[]).filter((r) => r.status === "ACTIF")))
        .catch(console.error);
      loadData(currentPage);
    } catch (e: any) {
      console.error(e);
      // Propager le message d'erreur serveur (limite 100 articles, etc.)
      toast.error(e.message || "Erreur lors de la validation.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && liquidations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement des liquidations TPS en attente...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      {/* ─── Avertissements limite d'articles par rôle TPS ─── */}
      {activeRolesTps
        .filter((r) => r.dernier_article >= 95)
        .map((r) => (
          <div
            key={r.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
              r.dernier_article >= 100
                ? "bg-red-50 border-red-300 text-red-800"
                : "bg-amber-50 border-amber-300 text-amber-800"
            }`}
          >
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              {r.dernier_article >= 100 ? (
                <>
                  <span className="font-bold">Rôle TPS #{r.numero_role} – {r.commune} bloqué :</span>{" "}
                  Le numéro d&apos;article a atteint <strong>100/100</strong>. Vous devez{" "}
                  <strong>clôturer ce rôle TPS</strong> avant de valider de nouveaux avis.
                </>
              ) : (
                <>
                  <span className="font-bold">Rôle TPS #{r.numero_role} – {r.commune} :</span>{" "}
                  Il reste <strong>{100 - r.dernier_article} article(s)</strong> disponibles sur 100.
                  Pensez à clôturer ce rôle bientôt.
                </>
              )}
            </div>
          </div>
        ))}

      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Filtrer par Nom, Raison Sociale, IFU ou Référence..."
            className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {filteredLiquidations.length} résultat(s) affiché(s)
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left">IFU / NC</th>
                <th className="px-6 py-4 text-left">Raison Sociale</th>
                <th className="px-6 py-4 text-left">Référence</th>
                <th className="px-6 py-4 text-right">Impôt dû</th>
                <th className="px-6 py-4 text-left">Créé le</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {filteredLiquidations.map((liq) => (
                <tr key={liq.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium text-slate-600">
                    {liq.contribuable?.ifu_nc}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {liq.contribuable?.nom_raison_sociale}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{liq.reference_tps}</td>
                  <td className="px-6 py-4 text-right font-mono font-medium">
                    {liq.impot_du.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                    {liq.created_at ? new Date(liq.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    }) : "—"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenValidate(liq)}
                        className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm transition"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Valider
                      </button>
                      <button
                        onClick={() => handleOpenEdit(liq)}
                        className="inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleOpenCancel(liq)}
                        className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg shadow-sm transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Annuler
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLiquidations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">
                    Aucune liquidation TPS en attente de validation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalCount > PAGE_SIZE && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* MODAL: VALIDATION DE LA LIQUIDATION */}
      {isValidateOpen && selectedLiquidation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              Confirmer la validation
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Voulez-vous valider définitivement la fiche TPS de{" "}
              <strong className="text-slate-900 break-words inline-block max-w-full">
                {selectedLiquidation.contribuable?.nom_raison_sociale}
              </strong>{" "}
              ? Cette action générera un numéro d'article dans le rôle communal actif de{" "}
              <strong>{selectedLiquidation.contribuable?.commune}</strong>.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsValidateOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleValidateConfirm}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
              >
                {isSaving ? "Validation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ANNULATION */}
      {isCancelOpen && selectedLiquidation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-650 flex items-center gap-2" style={{ color: "#dc2626" }}>
              <AlertTriangle className="w-5 h-5" />
              Annuler la fiche TPS
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Êtes-vous sûr de vouloir annuler la fiche de{" "}
              <strong className="text-slate-900 break-words inline-block max-w-full">
                {selectedLiquidation.contribuable?.nom_raison_sociale}
              </strong> (Ref:{" "}
              {selectedLiquidation.reference_tps}) ? Cette opération est irréversible.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Garder intacte
              </button>
              <button
                type="button"
                onClick={handleCancelSubmit}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 hover:bg-red-750 text-white rounded-lg text-sm font-semibold shadow-sm transition animate-pulse"
              >
                {isSaving ? "Annulation..." : "Annuler la fiche"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MODIFICATION / EDITION */}
      {isEditOpen && editFormData && selectedLiquidation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-100 rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" />
                Modifier la fiche TPS : {selectedLiquidation.reference_tps}
              </h3>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <TpsForm
              formData={editFormData}
              onChange={setEditFormData}
              onReset={() => {}}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditOpen(false)}
              isSubmitting={isSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
