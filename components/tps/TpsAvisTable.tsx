"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fetchAvisValidesTps, incrementTpsDownloadCount, updatePaidTpsLiquidation } from "@/actions/tpsActions";
import type { TpsInput } from "@/utils/tpsCalculations";
import { useToast, ToastContainer } from "@/components/useToast";
import { TpsPreview } from "./TpsPreview";
import { generateTpsPdf } from "@/utils/tpsPdfGenerator";
import { Loader2, Search, X, Download, Edit, Lock, AlertTriangle } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { createClient } from "@/utils/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type Role = {
  id: string;
  commune: string;
  annee: number;
  numero_role: number;
  status: string;
};

type Article = {
  id: string;
  numero_article: number;
  exercice: number;
  annee_mise_recouvrement: number;
  role: Role | Role[];
};

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
  validated_at: string;
  activite: string;
  montant_autres_activites: number;
  tps_calcule: number;
  portb: number;
  impot_du: number;
  acomptes_payes: number;
  reste_du: number;
  start_year: number;
  contribuable: Contribuable;
  articles?: Article[];
  download_count?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleStatusFromArticles(articles?: Article[]): "ACTIF" | "CLOTURE" | null {
  if (!articles || articles.length === 0) return null;
  const role = Array.isArray(articles[0].role) ? articles[0].role[0] : articles[0].role;
  return (role?.status as "ACTIF" | "CLOTURE") ?? null;
}

function liqToTpsInput(liq: LiquidationTps): TpsInput {
  return {
    nomRaisonSociale: liq.contribuable?.nom_raison_sociale || "",
    ifuNc: liq.contribuable?.ifu_nc || "",
    telephone: liq.contribuable?.telephone || "",
    commune: liq.contribuable?.commune || "",
    arrondissement: liq.contribuable?.arrondissement || "",
    quartier: liq.contribuable?.quartier || "",
    localisation: liq.contribuable?.localisation || "",
    activite: liq.activite || "",
    montantAutresActivites: liq.montant_autres_activites || 0,
    acomptesPayes: liq.acomptes_payes || 0,
    startYear: liq.start_year || new Date().getFullYear(),
  };
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function TpsAvisTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  // ─ État liste
  const [avisList, setAvisList] = useState<LiquidationTps[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // ─ Droits utilisateur
  const [userRole, setUserRole] = useState<string | null>(null);
  const canEdit = userRole === "ADMIN" || userRole === "INSPECTEUR";

  // ─ État modale d'édition
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedLiq, setSelectedLiq] = useState<LiquidationTps | null>(null);
  const [editFormData, setEditFormData] = useState<TpsInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ─ PDF
  const [pdfTarget, setPdfTarget] = useState<LiquidationTps | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

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
  const loadData = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const { data, totalCount: total } = await fetchAvisValidesTps({ page });
        setAvisList((data ?? []) as unknown as LiquidationTps[]);
        setTotalCount(total);
      } catch (e) {
        console.error(e);
        toast.error("Erreur lors du chargement des avis validés.");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadData(currentPage);
  }, [currentPage, loadData]);

  // ─── Pagination ──────────────────────────────────────────────────────────
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
    setSearchQuery("");
  };

  // ─── Recherche ───────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (currentPage !== 1) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const filteredAvisList = useMemo(() => {
    if (!searchQuery.trim()) return avisList;
    const q = searchQuery.toLowerCase().trim();
    return avisList.filter((liq) => {
      const nom = (liq.contribuable?.nom_raison_sociale || "").toLowerCase();
      const ifu = (liq.contribuable?.ifu_nc || "").toLowerCase();
      const ref = (liq.reference_tps || "").toLowerCase();
      return nom.includes(q) || ifu.includes(q) || ref.includes(q);
    });
  }, [avisList, searchQuery]);

  // ─── Téléchargement PDF ──────────────────────────────────────────────────
  const handleDownloadPdf = async (liq: LiquidationTps) => {
    if (pdfLoadingId) return;
    setPdfLoadingId(liq.id);
    try {
      await incrementTpsDownloadCount(liq.id);
      setAvisList((prev) =>
        prev.map((item) =>
          item.id === liq.id
            ? { ...item, download_count: (item.download_count || 0) + 1 }
            : item
        )
      );
    } catch (e) {
      console.error("Erreur incrémentation TPS:", e);
    }
    setPdfTarget(liq);
  };

  const hiddenDocumentId = pdfTarget ? `tps-document-${pdfTarget.id}` : "";

  useEffect(() => {
    if (!pdfTarget || !pdfFormData) return;
    const filename = `Avis_TPS_${pdfTarget.reference_tps}.pdf`;
    try {
      generateTpsPdf(pdfFormData, pdfArticlesStr, pdfRoleNum, pdfDateStr, filename);
      toast.success("Avis de mise en recouvrement téléchargé avec succès.");
    } catch (error) {
      console.error("Erreur génération PDF:", error);
      toast.error("Impossible de générer le PDF de cet avis.");
    } finally {
      setPdfLoadingId(null);
      setPdfTarget(null);
    }
  }, [pdfTarget, pdfFormData, pdfArticlesStr, pdfRoleNum, pdfDateStr, toast]);

  const pdfFormData = useMemo(() => {
    if (!pdfTarget) return null;
    return liqToTpsInput(pdfTarget);
  }, [pdfTarget]);

  const pdfArticlesStr = useMemo(() => {
    if (!pdfTarget?.articles?.length) return "A Générer";
    return pdfTarget.articles.map((a) => a.numero_article).sort((a, b) => a - b).join(", ");
  }, [pdfTarget]);

  const pdfRoleNum = useMemo(() => {
    if (!pdfTarget?.articles?.length) return "1";
    const r = Array.isArray(pdfTarget.articles[0].role)
      ? pdfTarget.articles[0].role[0]
      : pdfTarget.articles[0].role;
    return r?.numero_role ?? "1";
  }, [pdfTarget]);

  const pdfDateStr = useMemo(() => {
    if (!pdfTarget?.validated_at) return "";
    return new Date(pdfTarget.validated_at).toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }, [pdfTarget]);

  // ─── Ouvrir la modale d'édition ──────────────────────────────────────────
  const handleOpenEdit = (liq: LiquidationTps) => {
    setSelectedLiq(liq);
    setEditFormData(liqToTpsInput(liq));
    setEditError(null);
    setIsEditOpen(true);
  };

  // ─── Soumettre la modification ────────────────────────────────────────────
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiq || !editFormData) return;
    setIsSaving(true);
    setEditError(null);
    const result = await updatePaidTpsLiquidation(selectedLiq.id, editFormData);
    setIsSaving(false);
    if (!result.success) {
      setEditError(result.error || "Erreur lors de la modification.");
      return;
    }
    toast.success("Avis TPS modifié avec succès.");
    setIsEditOpen(false);
    loadData(currentPage);
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────
  if (loading && avisList.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement des avis validés...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      {/* Rendu caché pour PDF */}
      {pdfTarget && pdfFormData && (
        <div className="fixed -left-[9999px] -top-[9999px]">
          <TpsPreview
            formData={pdfFormData}
            documentId={hiddenDocumentId}
            articleNumbers={pdfArticlesStr}
            roleNumber={pdfRoleNum}
            dateEmission={pdfDateStr}
          />
        </div>
      )}

      {/* Barre de recherche */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Rechercher par Nom, Raison Sociale, IFU ou Référence..."
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
          {filteredAvisList.length} avis validé(s) affiché(s)
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left">IFU / NC</th>
                <th className="px-6 py-4 text-left">Raison Sociale</th>
                <th className="px-6 py-4 text-left">Articles</th>
                <th className="px-6 py-4 text-right">Impôt dû</th>
                <th className="px-6 py-4 text-right">Payé</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {filteredAvisList.map((liq) => {
                const arts = liq.articles || [];
                const artNumbers = arts.map((a) => a.numero_article).sort((a, b) => a - b).join(", ");
                const firstRole = arts[0]
                  ? Array.isArray(arts[0].role) ? arts[0].role[0] : arts[0].role
                  : null;
                const roleName = firstRole
                  ? `${firstRole.commune} Rôle ${firstRole.numero_role} (${firstRole.annee})`
                  : "-";
                const roleStatus = getRoleStatusFromArticles(arts);
                const isRoleActif = roleStatus === "ACTIF";
                const hasBeenDownloaded = !!(liq.download_count && liq.download_count > 0);

                return (
                  <tr
                    key={liq.id}
                    className={`transition-colors ${
                      hasBeenDownloaded
                        ? "bg-emerald-50/15 hover:bg-emerald-100/30 border-l-4 border-l-emerald-500/70"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-6 py-4 font-mono font-medium text-slate-600">
                      {liq.contribuable?.ifu_nc}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {liq.contribuable?.nom_raison_sociale}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold">
                      {liq.impot_du.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-600">
                      {liq.acomptes_payes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Bouton PDF */}
                        <button
                          onClick={() => handleDownloadPdf(liq)}
                          disabled={pdfLoadingId === liq.id}
                          className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition"
                        >
                          {pdfLoadingId === liq.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          Télécharger
                        </button>

                        {/* Compteur */}
                        {!hasBeenDownloaded ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold border border-gray-200 shadow-sm">
                            📥 0
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200/50 shadow-sm"
                            title={`${liq.download_count} téléchargement(s)`}
                          >
                            📥 {liq.download_count}
                          </span>
                        )}

                        {/* Bouton Modifier — Inspecteur/Admin + rôle ACTIF uniquement */}
                        {canEdit && isRoleActif && (
                          <button
                            onClick={() => handleOpenEdit(liq)}
                            className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-medium py-1.5 px-3 rounded-lg transition"
                            title="Modifier cet avis TPS"
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
              {filteredAvisList.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-400 italic">
                    Aucun avis TPS validé trouvé.
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

      {/* ─── MODALE D'ÉDITION TPS (Inspecteur / Admin uniquement) ─────────── */}
      {isEditOpen && editFormData && selectedLiq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col my-auto">

            {/* En-tête */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-amber-500" />
                  Modifier l'avis TPS {selectedLiq.reference_tps}
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

              {/* Section 1 : Identité */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Identité du contribuable
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Nom / Raison Sociale *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.nomRaisonSociale}
                      onChange={(e) => setEditFormData({ ...editFormData, nomRaisonSociale: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      IFU / NC *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.ifuNc}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setEditFormData({ ...editFormData, ifuNc: val });
                      }}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="text"
                      value={editFormData.telephone || ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setEditFormData({ ...editFormData, telephone: val.slice(0, 10) });
                      }}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 : Localisation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Localisation
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Commune *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.commune}
                      onChange={(e) => setEditFormData({ ...editFormData, commune: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Arrondissement *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.arrondissement}
                      onChange={(e) => setEditFormData({ ...editFormData, arrondissement: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
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
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Localisation (détail)</label>
                    <input
                      type="text"
                      value={editFormData.localisation || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, localisation: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3 : Activité & Chiffres */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Activité & Base de calcul
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Activité *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.activite}
                      onChange={(e) => setEditFormData({ ...editFormData, activite: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Montant autres activités (FCFA) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editFormData.montantAutresActivites}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, montantAutresActivites: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Acomptes payés (FCFA)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={editFormData.acomptesPayes}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, acomptesPayes: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Année / Exercice *
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
                </div>
              </div>

              {/* Erreur */}
              {editError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">{editError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
