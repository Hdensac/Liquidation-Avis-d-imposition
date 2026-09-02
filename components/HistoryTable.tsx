"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useToast, ToastContainer } from "./useToast";
import {
  fetchAvisRecouvrementDetails,
  incrementLiquidationDownloadCount,
  fetchHistoryLiquidationsPaginated,
  updatePaidLiquidation,
  fetchValeurAdministrative,
} from "@/actions/liquidationActions";
import { generateAvisRecouvrementPdf } from "@/utils/avisPdfGenerator";
import { Download, Loader2, Search, X, Edit, AlertTriangle, Lock } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { usePagination } from "@/hooks/usePagination";
import type { TaxpayerInput } from "@/types/liquidation";
import {
  COMMUNE_OPTIONS,
  getArrondissementsForCommune,
  findMatchingArrondissement,
} from "@/components/TaxForm";
import { createClient } from "@/utils/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type ContribuableDetail = {
  id: string;
  nom_prenoms: string;
  ifu_npi: string;
  telephone: string;
  commune: string;
  arrondissement: string;
  quartier: string;
};

type RoleRef = { id: string; status: "ACTIF" | "CLOTURE" };
type RecouvrementRef = { role: RoleRef | RoleRef[] };

type Recouvrement = {
  id: string;
  reference_liq: string;
  status: string;
  created_at: string;
  validated_at?: string;
  download_count?: number;
  superficie?: number;
  superficie_imposable?: number | null;
  valeur_locative?: number;
  start_year?: number;
  type_bien?: string | null;
  is_loue?: boolean | null;
  valeur_irf?: number | null;
  description?: string | null;
  contribuable: ContribuableDetail | ContribuableDetail[];
  recouvrement?: RecouvrementRef | RecouvrementRef[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getContribuable(c: ContribuableDetail | ContribuableDetail[]): ContribuableDetail {
  if (Array.isArray(c))
    return c[0] ?? { id: "", nom_prenoms: "-", ifu_npi: "-", telephone: "-", commune: "", arrondissement: "", quartier: "" };
  return c;
}

function getRoleStatus(rec: Recouvrement): "ACTIF" | "CLOTURE" | null {
  const r = Array.isArray(rec.recouvrement) ? rec.recouvrement[0] : rec.recouvrement;
  if (!r) return null;
  const role = Array.isArray(r.role) ? r.role[0] : r.role;
  return role?.status ?? null;
}

function recouvrementToFormData(rec: Recouvrement): TaxpayerInput {
  const c = getContribuable(rec.contribuable);
  const isBati = rec.type_bien === "BATI";
  const arr = findMatchingArrondissement(c.commune || "", c.arrondissement || "");
  return {
    fullname: c.nom_prenoms || "",
    ifuNpi: c.ifu_npi || "",
    phone: c.telephone || "",
    commune: c.commune || "",
    arrondissement: arr,
    quartier: c.quartier || "",
    typeBien: isBati ? "BATI" : "NON_BATI",
    superficie: Number(rec.superficie) || 0,
    superficieImposable:
      typeof rec.superficie_imposable === "number" && rec.superficie_imposable > 0
        ? Number(rec.superficie_imposable)
        : "",
    valeurLocative: Number(rec.valeur_locative) || 0,
    startYear: Number(rec.start_year) || new Date().getFullYear(),
    isLoue: isBati ? (rec.is_loue ?? false) : false,
    valeurIrf: isBati && rec.valeur_irf ? Number(rec.valeur_irf) : "",
    description: isBati ? (rec.description ?? "") : "",
  };
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function HistoryTable() {
  const { currentPage, setPage, resetPage } = usePagination();

  // ─ État de liste
  const [records, setRecords] = useState<Recouvrement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ─ Droits utilisateur
  const [userRole, setUserRole] = useState<string | null>(null);
  const canEdit = userRole === "ADMIN" || userRole === "INSPECTEUR";

  // ─ État modale d'édition
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Recouvrement | null>(null);
  const [editFormData, setEditFormData] = useState<TaxpayerInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [loadingVa, setLoadingVa] = useState(false);

  const { toast, toasts } = useToast();

  // ─── Charger le rôle de l'utilisateur connecté ───────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile) setUserRole(profile.role);
      }
    };
    fetchUser();
  }, []);

  // ─── Chargement paginé ───────────────────────────────────────────────────
  const loadHistory = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const { data, totalCount: total } = await fetchHistoryLiquidationsPaginated({ page });
        setRecords(data as unknown as Recouvrement[]);
        setTotalCount(total);
      } catch (e) {
        console.error(e);
        toast.error("Erreur lors du chargement de l'historique.");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadHistory(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // ─── Pagination ──────────────────────────────────────────────────────────
  const handlePageChange = (page: number) => {
    setPage(page);
    setSearchQuery("");
  };

  // ─── Recherche ───────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (currentPage !== 1) {
      resetPage();
    }
  };

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter((rec) => {
      const c = getContribuable(rec.contribuable);
      const nom = (c.nom_prenoms || "").toLowerCase();
      const ifu = (c.ifu_npi || "").toLowerCase();
      const ref = (rec.reference_liq || "").toLowerCase();
      return nom.includes(q) || ifu.includes(q) || ref.includes(q);
    });
  }, [records, searchQuery]);

  // ─── Téléchargement PDF avis ─────────────────────────────────────────────
  const handleDownloadAvis = async (liquidationId: string, reference: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(liquidationId);
    try {
      await incrementLiquidationDownloadCount(liquidationId);
      setRecords((prev) =>
        prev.map((rec) =>
          rec.id === liquidationId
            ? { ...rec, download_count: (rec.download_count || 0) + 1 }
            : rec
        )
      );
      const details = await fetchAvisRecouvrementDetails(liquidationId);
      await generateAvisRecouvrementPdf(details, `Avis_Recouvrement_${reference}.pdf`);
      toast.success("Avis PDF généré.");
    } catch (error) {
      console.error(error);
      toast.error("Impossible de générer l'avis PDF.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // ─── Ouvrir la modale d'édition ──────────────────────────────────────────
  const handleOpenEdit = (rec: Recouvrement) => {
    setSelectedRecord(rec);
    setEditFormData(recouvrementToFormData(rec));
    setEditError(null);
    setIsEditOpen(true);
  };

  // ─── Charger la valeur administrative lors du changement de commune ───────
  useEffect(() => {
    if (!editFormData?.commune || !isEditOpen || editFormData.typeBien === "BATI") return;
    let active = true;
    const loadVa = async () => {
      setLoadingVa(true);
      try {
        const va = await fetchValeurAdministrative(editFormData.commune);
        if (active) {
          setEditFormData((prev) =>
            prev ? { ...prev, valeurLocative: va !== null ? va : "" } : null
          );
        }
      } catch (err) {
        console.error("Erreur récupération VA:", err);
      } finally {
        if (active) setLoadingVa(false);
      }
    };
    loadVa();
    return () => { active = false; };
  }, [editFormData?.commune, isEditOpen, editFormData?.typeBien]);

  // ─── Soumettre la modification ────────────────────────────────────────────
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !editFormData) return;
    setIsSaving(true);
    setEditError(null);
    const result = await updatePaidLiquidation(selectedRecord.id, editFormData);
    setIsSaving(false);
    if (!result.success) {
      setEditError(result.error || "Erreur lors de la modification.");
      return;
    }
    toast.success("Liquidation modifiée avec succès.");
    setIsEditOpen(false);
    loadHistory(currentPage);
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement...
      </div>
    );

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      {/* Barre de recherche */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Filtrer par Nom, Prénom, IFU/NPI ou Référence..."
            className="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          {filteredRecords.length} résultat(s) sur cette page
        </div>
      </div>

      {/* VUE MOBILE (Cartes) */}
      <div className="md:hidden space-y-3">
        {filteredRecords.map((rec) => {
          const c = getContribuable(rec.contribuable);
          const isActionLoading = actionLoadingId === rec.id;
          const hasBeenDownloaded = !!(rec.download_count && rec.download_count > 0);
          const roleStatus = getRoleStatus(rec);
          const isRoleActif = roleStatus === "ACTIF";

          return (
            <div
              key={rec.id}
              className={`p-4 rounded-xl border bg-white dark:bg-gray-800 shadow-sm space-y-3 ${
                hasBeenDownloaded
                  ? "border-l-4 border-l-emerald-500 border-gray-200 dark:border-gray-700"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.nom_prenoms}</h3>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">IFU/NPI: {c.ifu_npi}</div>
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {rec.reference_liq}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                <div><span className="font-medium text-gray-700 dark:text-gray-300">Validé le:</span> {rec.validated_at ? new Date(rec.validated_at).toLocaleDateString("fr-FR") : "-"}</div>
                <div><span className="font-medium text-gray-700 dark:text-gray-300">Créée le:</span> {new Date(rec.created_at).toLocaleDateString("fr-FR")}</div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDownloadAvis(rec.id, rec.reference_liq)}
                    disabled={isActionLoading}
                    className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition"
                  >
                    {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Avis PDF
                  </button>
                  {hasBeenDownloaded ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/50">
                      📥 {rec.download_count}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 font-semibold border border-gray-200 dark:border-gray-700">
                      📥 0
                    </span>
                  )}
                </div>

                {canEdit && isRoleActif && (
                  <button
                    onClick={() => handleOpenEdit(rec)}
                    className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium py-1.5 px-3 rounded-lg transition"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredRecords.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            {searchQuery ? "Aucun enregistrement ne correspond à votre recherche." : "Aucun historique disponible."}
          </div>
        )}
      </div>

      {/* VUE DESKTOP (Tableau) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">IFU/NPI</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Nom / Prénom</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Validé le</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Référence</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider">Créée le</th>
              <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((rec) => {
              const c = getContribuable(rec.contribuable);
              const isActionLoading = actionLoadingId === rec.id;
              const hasBeenDownloaded = !!(rec.download_count && rec.download_count > 0);
              const roleStatus = getRoleStatus(rec);
              const isRoleActif = roleStatus === "ACTIF";

              return (
                <tr
                  key={rec.id}
                  className={`align-top border-b border-gray-300 dark:border-gray-600 transition ${
                    hasBeenDownloaded
                      ? "bg-emerald-50/15 hover:bg-emerald-100/30 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 border-l-4 border-l-emerald-500/70"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <td className="px-4 py-2 font-mono text-xs">{c.ifu_npi}</td>
                  <td className="px-4 py-2 max-w-[260px] truncate" title={c.nom_prenoms}>{c.nom_prenoms}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {rec.validated_at ? new Date(rec.validated_at).toLocaleDateString("fr-FR") : "-"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">{rec.reference_liq}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {new Date(rec.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2 flex-nowrap">
                      {/* Bouton Avis PDF */}
                      <button
                        onClick={() => handleDownloadAvis(rec.id, rec.reference_liq)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition"
                        title="Télécharger l'avis PDF"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        Avis PDF
                      </button>

                      {/* Compteur de téléchargements */}
                      {!hasBeenDownloaded ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 font-semibold border border-gray-200 dark:border-gray-700 shadow-sm">
                          📥 0
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/50 shadow-sm"
                          title={`${rec.download_count} téléchargement(s)`}
                        >
                          📥 {rec.download_count}
                        </span>
                      )}

                      {/* Bouton Modifier — visible uniquement Inspecteur/Admin ET rôle ACTIF */}
                      {canEdit && isRoleActif && (
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium py-1.5 px-3 rounded-lg transition"
                          title="Modifier cette liquidation"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Modifier
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  {searchQuery
                    ? "Aucun enregistrement ne correspond à votre recherche."
                    : "Aucun historique disponible."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />

      {/* ─── MODALE D'ÉDITION (Inspecteur / Admin uniquement) ─────────────── */}
      {isEditOpen && editFormData && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col my-auto">

            {/* En-tête */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-amber-500" />
                  Modifier la liquidation {selectedRecord.reference_liq}
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                  ⚠ Accès Inspecteur/Admin — Toute modification est enregistrée dans les logs d'audit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 ml-4"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Section 1 : Identité du contribuable */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Identité du contribuable
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      IFU / NPI *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.ifuNpi}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setEditFormData({ ...editFormData, ifuNpi: val });
                      }}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Nom & Prénom(s) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.fullname}
                      onChange={(e) => setEditFormData({ ...editFormData, fullname: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setEditFormData({ ...editFormData, phone: val.slice(0, 10) });
                      }}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 : Localisation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Localisation du bien
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Commune *</label>
                    <select
                      value={editFormData.commune}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, commune: e.target.value, arrondissement: "" })
                      }
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="">Sélectionner...</option>
                      {COMMUNE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Arrondissement *</label>
                    <select
                      required
                      value={findMatchingArrondissement(editFormData.commune, editFormData.arrondissement)}
                      onChange={(e) => setEditFormData({ ...editFormData, arrondissement: e.target.value })}
                      disabled={!editFormData.commune}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Sélectionner...</option>
                      {getArrondissementsForCommune(editFormData.commune).map((arr) => (
                        <option key={arr} value={arr}>{arr}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Quartier *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.quartier}
                      onChange={(e) => setEditFormData({ ...editFormData, quartier: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3 : Caractéristiques & Calcul */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Caractéristiques de la parcelle
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Type de bien — verrouillé */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Type de bien (Non modifiable)
                    </label>
                    <select
                      disabled
                      value={editFormData.typeBien}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 cursor-not-allowed focus:outline-none"
                    >
                      <option value="NON_BATI">Non bâti / FNB</option>
                      <option value="BATI">F. Bâti / FB</option>
                    </select>
                  </div>

                  {/* Superficie (FNB) */}
                  {editFormData.typeBien === "NON_BATI" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Superficie totale (m²) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={editFormData.superficie}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, superficie: Number(e.target.value) || 0 })
                        }
                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Valeur locative */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {editFormData.typeBien === "BATI" ? "Valeur Locative / VL (FCFA) *" : "Valeur administrative (VL)"}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={editFormData.typeBien === "NON_BATI"}
                        value={editFormData.valeurLocative}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, valeurLocative: Number(e.target.value) || 0 })
                        }
                        className={`w-full px-3.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                          editFormData.typeBien === "BATI"
                            ? "bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                            : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 cursor-not-allowed"
                        }`}
                      />
                      {loadingVa && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Année exercice — modifiable par Inspecteur/Admin */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Année / Exercice Principal *
                    </label>
                    <input
                      type="number"
                      required
                      min={2000}
                      max={2100}
                      value={editFormData.startYear}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, startYear: Number(e.target.value) || new Date().getFullYear() })
                      }
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Superficie Imposable (FNB, Inspecteur/Admin) */}
                  {editFormData.typeBien === "NON_BATI" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Superficie Imposable (Exonération — optionnel)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={Number(editFormData.superficie) - 1}
                        placeholder="Laisser vide si pas d'exonération"
                        value={editFormData.superficieImposable}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            superficieImposable: e.target.value === "" ? "" : Number(e.target.value),
                          })
                        }
                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Champs supplémentaires Bâti */}
                {editFormData.typeBien === "BATI" && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Description du bâtiment (TFU/FB)
                      </label>
                      <input
                        type="text"
                        value={editFormData.description ?? ""}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        placeholder="Ex: 1BAT DE 1P X 6 SISE A ..."
                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30">
                      <input
                        type="checkbox"
                        id="editHistIsLoue"
                        checked={editFormData.isLoue ?? false}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            isLoue: e.target.checked,
                            valeurIrf: e.target.checked ? editFormData.valeurIrf : "",
                          })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="editHistIsLoue" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Bâtiment en location
                        <span className="ml-1 text-xs font-normal text-gray-400">(IRF Micro Foncier + P-ORTB)</span>
                      </label>
                    </div>

                    {editFormData.isLoue && (
                      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                        <label className="block text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
                          Valeur IRF — Base Micro Foncier (FCFA) *
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={editFormData.valeurIrf ?? ""}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              valeurIrf: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                          placeholder="Ex: 216 000"
                          className="w-full px-3.5 py-2 bg-white dark:bg-gray-900/50 border border-blue-300 dark:border-blue-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          IRF = Valeur IRF × 12% — Exercice : {Number(editFormData.startYear) - 1}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Erreur */}
              {editError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">{editError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
