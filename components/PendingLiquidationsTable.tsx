"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fetchPendingLiquidationsPaginated, validatePayment, updateLiquidation, cancelLiquidation, fetchValeurAdministrative } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "./useToast";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";
import { LiquidationPreview } from "@/components/LiquidationPreview";
import { generatePDFFromElement } from "@/utils/pdfGenerator";
import { FileText, Loader2, Search, X, Edit, Trash2, AlertTriangle } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import type { TaxpayerInput } from "@/types/liquidation";
import { COMMUNE_OPTIONS, ARRONDISSEMENTS_PAR_COMMUNE } from "@/components/TaxForm";
import { createClient } from "@/utils/supabase/client";

type Contribuable = {
  nom_prenoms: string;
  ifu_npi: string;
  telephone: string;
  commune: string;
  arrondissement: string;
  quartier: string;
};

type Liquidation = {
  id: string;
  reference_liq: string;
  status: string;
  created_at: string;
  superficie: number;
  superficie_imposable?: number | null;
  valeur_locative: number;
  start_year: number;
  type_bien?: string | null;
  contribuable: Contribuable[] | Contribuable;
};

function getContribuable(c: Contribuable[] | Contribuable): Contribuable {
  if (Array.isArray(c)) {
    return c[0] ?? {
      nom_prenoms: "-",
      ifu_npi: "-",
      telephone: "-",
      commune: "",
      arrondissement: "",
      quartier: "",
    };
  }
  return c;
}

function liquidationToFormData(liq: Liquidation): TaxpayerInput {
  const contribuable = getContribuable(liq.contribuable);
  return {
    fullname: contribuable.nom_prenoms || "",
    ifuNpi: contribuable.ifu_npi || "",
    phone: contribuable.telephone || "",
    commune: contribuable.commune || "",
    arrondissement: contribuable.arrondissement || "",
    quartier: contribuable.quartier || "",
    typeBien: liq.type_bien === "BATI" ? "BATI" : "NON_BATI",
    superficie: Number(liq.superficie) || 0,
    superficieImposable:
      typeof liq.superficie_imposable === "number" && liq.superficie_imposable > 0
        ? Number(liq.superficie_imposable)
        : "",
    valeurLocative: Number(liq.valeur_locative) || 0,
    startYear: Number(liq.start_year) || new Date().getFullYear(),
  };
}

export default function PendingLiquidationsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfTarget, setPdfTarget] = useState<Liquidation | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const { toast, toasts } = useToast();

  // Nouveaux états pour le CRUD
  const [selectedLiquidation, setSelectedLiquidation] = useState<Liquidation | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [editFormData, setEditFormData] = useState<TaxpayerInput | null>(null);
  const [loadingVa, setLoadingVa] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Charger le rôle utilisateur au montage
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
        if (profile) {
          setUserRole(profile.role);
        }
      }
    };
    fetchUser();
  }, []);

  const canApplyExo = userRole === "ADMIN" || userRole === "INSPECTEUR";

  const loadData = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const { data, totalCount: total } = await fetchPendingLiquidationsPaginated({ page });
        setLiquidations((data ?? []) as Liquidation[]);
        setTotalCount(total);
      } catch (e) {
        console.error(e);
        toast.error("Erreur lors du chargement des liquidations en attente.");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadData(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

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
      const c = getContribuable(liq.contribuable);
      const nom = (c.nom_prenoms || "").toLowerCase();
      const ifu = (c.ifu_npi || "").toLowerCase();
      const ref = (liq.reference_liq || "").toLowerCase();
      return nom.includes(q) || ifu.includes(q) || ref.includes(q);
    });
  }, [liquidations, searchQuery]);

  const pdfFormData = useMemo(() => (pdfTarget ? liquidationToFormData(pdfTarget) : null), [pdfTarget]);
  const pdfCalculations = useMemo(
    () => (pdfFormData ? buildLiquidationCalculations(pdfFormData) : null),
    [pdfFormData]
  );
  const hiddenDocumentId = pdfTarget ? `liquidation-document-${pdfTarget.id}` : "";

  useEffect(() => {
    if (!pdfTarget || !pdfFormData || !pdfCalculations) return;
    const filename = `Liquidation_${pdfTarget.reference_liq}.pdf`;
    const timer = window.setTimeout(async () => {
      try {
        await generatePDFFromElement(hiddenDocumentId, filename);
      } catch (error) {
        console.error("Erreur lors de la regeneration du PDF:", error);
        toast.error("Impossible de generer le PDF de cette liquidation.");
      } finally {
        setPdfLoadingId(null);
        setPdfTarget(null);
      }
    }, 80);

    return () => window.clearTimeout(timer);
  }, [hiddenDocumentId, pdfCalculations, pdfFormData, pdfTarget, toast]);

  const handleValidate = async (id: string) => {
    try {
      await validatePayment(id);
      toast.success("Paiement valide, avis de recouvrement genere.");
      loadData(currentPage);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la validation du paiement.");
    }
  };
  
  // Ouvrir la modale d'édition
  const handleOpenEdit = (liq: Liquidation) => {
    setSelectedLiquidation(liq);
    setEditFormData(liquidationToFormData(liq));
    setIsEditOpen(true);
  };

  // Surveiller le changement de commune pour charger dynamiquement la valeur administrative
  useEffect(() => {
    if (!editFormData?.commune || !isEditOpen) return;
    
    let active = true;
    const loadVa = async () => {
      setLoadingVa(true);
      try {
        const va = await fetchValeurAdministrative(editFormData.commune);
        if (active) {
          setEditFormData((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              arrondissement: "", // Réinitialisation de l'arrondissement pour cohérence
              valeurLocative: va !== null ? va : "",
            };
          });
        }
      } catch (err) {
        console.error("Erreur lors de la récupération de la VA dans la modale:", err);
      } finally {
        if (active) setLoadingVa(false);
      }
    };

    loadVa();
    return () => {
      active = false;
    };
  }, [editFormData?.commune, isEditOpen]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiquidation || !editFormData) return;

    setIsSaving(true);
    try {
      await updateLiquidation(selectedLiquidation.id, editFormData);
      toast.success("Liquidation modifiee avec succes.");
      setIsEditOpen(false);
      loadData(currentPage);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de la modification de la liquidation.");
    } finally {
      setIsSaving(false);
    }
  };

  // Ouvrir la modale d'annulation
  const handleOpenCancel = (liq: Liquidation) => {
    setSelectedLiquidation(liq);
    setCancelReason("");
    setIsCancelOpen(true);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiquidation || !cancelReason.trim()) return;

    setIsSaving(true);
    try {
      await cancelLiquidation(selectedLiquidation.id, cancelReason);
      toast.success("Liquidation annulee avec succes.");
      setIsCancelOpen(false);
      loadData(currentPage);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erreur lors de l'annulation de la liquidation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = (liquidation: Liquidation) => {
    if (pdfLoadingId) return;
    setPdfLoadingId(liquidation.id);
    setPdfTarget(liquidation);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Filtrer par Nom, Prenom, IFU/NPI ou Reference..."
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
          {filteredLiquidations.length} resultat(s) sur cette page
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">IFU/NPI</th>
              <th className="px-4 py-2 text-left">Nom / Prenom</th>
              <th className="px-4 py-2 text-left">Telephone</th>
              <th className="px-4 py-2 text-left">Reference</th>
              <th className="px-4 py-2 text-left">Creee le</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredLiquidations.map((liq) => {
              const c = getContribuable(liq.contribuable);
              return (
                <tr
                  key={liq.id}
                  className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <td className="px-4 py-2">{c.ifu_npi}</td>
                  <td className="px-4 py-2">{c.nom_prenoms}</td>
                  <td className="px-4 py-2">{c.telephone}</td>
                  <td className="px-4 py-2">{liq.reference_liq}</td>
                  <td className="px-4 py-2">{new Date(liq.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => handleValidate(liq.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded text-xs transition transform hover:scale-105"
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => handleOpenEdit(liq)}
                        className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-3 rounded text-xs transition transform hover:scale-105"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                      <button
                        onClick={() => handleOpenCancel(liq)}
                        className="inline-flex items-center gap-1 bg-red-650 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded text-xs transition transform hover:scale-105"
                        style={{ backgroundColor: "#dc2626" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Annuler
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(liq)}
                        disabled={pdfLoadingId === liq.id}
                        className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-medium py-1.5 px-3 rounded text-xs transition transform hover:scale-105"
                      >
                        {pdfLoadingId === liq.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredLiquidations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {searchQuery
                    ? "Aucune liquidation ne correspond a votre recherche."
                    : "Aucun paiement en attente."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />

      {pdfTarget && pdfFormData && pdfCalculations ? (
        <div
          className="fixed pointer-events-none"
          style={{ left: "-10000px", top: 0, backgroundColor: "#ffffff" }}
          aria-hidden="true"
        >
          <LiquidationPreview
            formData={pdfFormData}
            calculations={pdfCalculations}
            documentId={hiddenDocumentId}
          />
        </div>
      ) : null}

      {/* MODALE D'EDITION */}
      {isEditOpen && editFormData && selectedLiquidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" />
                Modifier la liquidation {selectedLiquidation.reference_liq}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1 : Contribuable */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Identite du contribuable</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nom & Prenom(s) *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.fullname}
                      onChange={(e) => setEditFormData({ ...editFormData, fullname: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">IFU / NPI *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.ifuNpi}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, "");
                        setEditFormData({ ...editFormData, ifuNpi: val });
                      }}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Telephone *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.phone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, "");
                        setEditFormData({ ...editFormData, phone: val.slice(0, 10) });
                      }}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 : Localisation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Localisation du bien</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Commune *</label>
                    <select
                      value={editFormData.commune}
                      onChange={(e) => setEditFormData({ ...editFormData, commune: e.target.value })}
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
                      value={editFormData.arrondissement}
                      onChange={(e) => setEditFormData({ ...editFormData, arrondissement: e.target.value })}
                      disabled={!editFormData.commune}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Sélectionner...</option>
                      {(ARRONDISSEMENTS_PAR_COMMUNE[editFormData.commune] ?? []).map((arr) => (
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

              {/* Section 3 : Caracteristiques & Calcul */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Caracteristiques de la parcelle</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-750 text-gray-500 mb-1">Type de bien (Non modifiable)</label>
                    <select
                      disabled
                      value={editFormData.typeBien}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 cursor-not-allowed focus:outline-none"
                    >
                      <option value="NON_BATI">Non bâti</option>
                      <option value="BATI">Bâtiment / Construit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Superficie totale (m²) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editFormData.superficie}
                      onChange={(e) => setEditFormData({ ...editFormData, superficie: Number(e.target.value) || "" })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-750 text-gray-500 mb-1">Valeur administrative (VL) (Fixe)</label>
                    <div className="relative">
                      <input
                        type="number"
                        disabled
                        value={editFormData.valeurLocative}
                        className="w-full px-3.5 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 cursor-not-allowed focus:outline-none"
                      />
                      {loadingVa && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-750 text-gray-500 mb-1">Année de départ (Non modifiable)</label>
                    <input
                      type="number"
                      disabled
                      value={editFormData.startYear}
                      className="w-full px-3.5 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  {canApplyExo && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Superficie Imposable (Optionnel - Exonération)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={Number(editFormData.superficie) - 1}
                        placeholder="Laisser vide si pas d'exonération"
                        value={editFormData.superficieImposable}
                        onChange={(e) => setEditFormData({ ...editFormData, superficieImposable: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Pied de formulaire */}
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

      {/* MODALE D'ANNULATION */}
      {isCancelOpen && selectedLiquidation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Annuler la liquidation
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Référence : {selectedLiquidation.reference_liq}
                </p>
              </div>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-700 dark:text-red-400">
                Cette action est définitive. La liquidation passera au statut <strong>ANNULÉ</strong> et ne pourra plus être validée pour paiement.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Motif de l'annulation *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Veuillez spécifier la raison (ex: Erreur de saisie de superficie, doublon...)"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !cancelReason.trim()}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmer l'annulation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
