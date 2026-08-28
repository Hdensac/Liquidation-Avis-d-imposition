"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fetchPendingLiquidationsPaginated, validatePayment, updateLiquidation, cancelLiquidation, fetchValeurAdministrative, fetchAllRoles } from "@/actions/liquidationActions";
import type { RoleSummary } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "./useToast";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";
import { LiquidationPreview } from "@/components/LiquidationPreview";
import { generateLiquidationPdf } from "@/utils/liquidationPdfGenerator";
import { FileText, Loader2, Search, X, Edit, Trash2, AlertTriangle } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import type { TaxpayerInput } from "@/types/liquidation";
import { COMMUNE_OPTIONS, ARRONDISSEMENTS_PAR_COMMUNE, getArrondissementsForCommune, findMatchingArrondissement } from "@/components/TaxForm";
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
  // Champs Foncier Bâti (FB)
  is_loue?: boolean | null;
  valeur_irf?: number | null;
  description?: string | null;
  commune?: string | null;
  arrondissement?: string | null;
  quartier?: string | null;
  contribuable: Contribuable[] | Contribuable;
};

function getContribuable(liq: Liquidation | (Contribuable[] | Contribuable)): Contribuable {
  if (!liq) {
    return { nom_prenoms: "-", ifu_npi: "-", telephone: "-", commune: "", arrondissement: "", quartier: "" };
  }
  const isLiqObj = typeof liq === "object" && "contribuable" in liq;
  const rawContrib = isLiqObj ? (liq as Liquidation).contribuable : (liq as Contribuable[] | Contribuable);
  const c = Array.isArray(rawContrib) ? (rawContrib[0] ?? {}) : (rawContrib ?? {});

  return {
    nom_prenoms: c.nom_prenoms || "-",
    ifu_npi: c.ifu_npi || "-",
    telephone: c.telephone || "-",
    commune: (isLiqObj && (liq as Liquidation).commune) ? (liq as Liquidation).commune! : (c.commune || ""),
    arrondissement: (isLiqObj && (liq as Liquidation).arrondissement) ? (liq as Liquidation).arrondissement! : (c.arrondissement || ""),
    quartier: (isLiqObj && (liq as Liquidation).quartier) ? (liq as Liquidation).quartier! : (c.quartier || ""),
  };
}

function getRequiredArticlesCount(liq: Liquidation): number {
  const typeBien = liq.type_bien || "NON_BATI";
  if (typeBien === "BATI") {
    return liq.is_loue ? 3 : 1;
  }
  return 4;
}

function liquidationToFormData(liq: Liquidation): TaxpayerInput {
  const contribuable = getContribuable(liq);
  const isBati = liq.type_bien === "BATI";
  const comm = contribuable.commune || "";
  const arr = findMatchingArrondissement(comm, contribuable.arrondissement || "");
  return {
    fullname: contribuable.nom_prenoms || "",
    ifuNpi: contribuable.ifu_npi || "",
    phone: contribuable.telephone || "",
    commune: comm,
    arrondissement: arr,
    quartier: contribuable.quartier || "",
    typeBien: isBati ? "BATI" : "NON_BATI",
    superficie: Number(liq.superficie) || 0,
    superficieImposable:
      typeof liq.superficie_imposable === "number" && liq.superficie_imposable > 0
        ? Number(liq.superficie_imposable)
        : "",
    valeurLocative: Number(liq.valeur_locative) || 0,
    startYear: Number(liq.start_year) || new Date().getFullYear(),
    // Champs FB
    isLoue: isBati ? (liq.is_loue ?? false) : false,
    valeurIrf: isBati && liq.valeur_irf ? Number(liq.valeur_irf) : "",
    description: isBati ? (liq.description ?? "") : "",
  };
}

export default function PendingLiquidationsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [confirmSplit, setConfirmSplit] = useState<{
    liqId: string;
    required: number;
    placesCurrent: number;
    placesNext: number;
    roleNum: number;
  } | null>(null);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfTarget, setPdfTarget] = useState<Liquidation | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const { toast, toasts } = useToast();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Nouveaux états pour le CRUD
  const [selectedLiquidation, setSelectedLiquidation] = useState<Liquidation | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmRef, setCancelConfirmRef] = useState("");
  const [editFormData, setEditFormData] = useState<TaxpayerInput | null>(null);
  const [loadingVa, setLoadingVa] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [activeRoles, setActiveRoles] = useState<RoleSummary[]>([]);

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

  // Charger les rôles actifs pour l'affichage de l'avertissement de limite d'articles
  useEffect(() => {
    fetchAllRoles()
      .then((roles) => setActiveRoles(roles.filter((r) => r.status === "ACTIF")))
      .catch(console.error);
  }, []);

  const canApplyExo = userRole === "ADMIN" || userRole === "INSPECTEUR";

  const loadData = useCallback(
    async (page: number, search?: string) => {
      setLoading(true);
      try {
        const { data, totalCount: total } = await fetchPendingLiquidationsPaginated({ page, search });
        setLiquidations((data ?? []) as unknown as Liquidation[]);
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
    loadData(currentPage, debouncedSearch);
  }, [currentPage, debouncedSearch, loadData]);

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
    return liquidations;
  }, [liquidations]);

  const pdfFormData = useMemo(() => (pdfTarget ? liquidationToFormData(pdfTarget) : null), [pdfTarget]);
  const pdfCalculations = useMemo(
    () => (pdfFormData ? buildLiquidationCalculations(pdfFormData) : null),
    [pdfFormData]
  );
  const hiddenDocumentId = pdfTarget ? `liquidation-document-${pdfTarget.id}` : "";

  useEffect(() => {
    if (!pdfTarget || !pdfFormData) return;
    const filename = `Liquidation_${pdfTarget.reference_liq}.pdf`;
    try {
      generateLiquidationPdf(pdfFormData, filename);
    } catch (error) {
      console.error("Erreur lors de la generation du PDF:", error);
      toast.error("Impossible de generer le PDF de cette liquidation.");
    } finally {
      setPdfLoadingId(null);
      setPdfTarget(null);
    }
  }, [pdfFormData, pdfTarget, toast]);

  const handleValidate = async (id: string) => {
    const liq = liquidations.find((l) => l.id === id);
    if (liq) {
      const c = getContribuable(liq);
      const activeRole = activeRoles.find((r) => r.commune.toLowerCase() === c.commune.toLowerCase());
      if (activeRole) {
        const required = getRequiredArticlesCount(liq);
        if (activeRole.dernier_article + required > 100 && activeRole.dernier_article < 100) {
          setConfirmSplit({
            liqId: id,
            required,
            placesCurrent: 100 - activeRole.dernier_article,
            placesNext: required - (100 - activeRole.dernier_article),
            roleNum: activeRole.numero_role
          });
          return;
        }
      }
    }

    try {
      await validatePayment(id);
      toast.success("Paiement valide, avis de recouvrement genere.");
      // Recharger les rôles actifs pour mettre à jour les indicateurs
      fetchAllRoles()
        .then((roles) => setActiveRoles(roles.filter((r) => r.status === "ACTIF")))
        .catch(console.error);
      loadData(currentPage);
    } catch (e: any) {
      console.error(e);
      // Afficher le message d'erreur du serveur (ex: limite de 100 articles)
      const msg = e?.message || "Erreur lors de la validation du paiement.";
      toast.error(msg);
    }
  };
  
  // Ouvrir la modale d'édition
  const handleOpenEdit = (liq: Liquidation) => {
    setSelectedLiquidation(liq);
    setEditFormData(liquidationToFormData(liq));
    setEditError(null);
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
    setEditError(null);
    try {
      const result = await updateLiquidation(selectedLiquidation.id, editFormData);
      setIsSaving(false);
      if (!result.success) {
        setEditError(result.error || "Erreur lors de la modification de la liquidation.");
        return;
      }
      toast.success("Liquidation modifiee avec succes.");
      setIsEditOpen(false);
      loadData(currentPage, debouncedSearch);
    } catch (err: any) {
      setIsSaving(false);
      const msg = err?.message || "Une erreur réseau est survenue. Veuillez réessayer.";
      setEditError(msg);
      console.error(err);
    }
  };

  // Ouvrir la modale d'annulation
  const handleOpenCancel = (liq: Liquidation) => {
    setSelectedLiquidation(liq);
    setCancelReason("");
    setCancelConfirmRef("");
    setIsCancelOpen(true);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLiquidation || !cancelReason.trim()) return;

    setIsSaving(true);
    try {
      const result = await cancelLiquidation(selectedLiquidation.id, cancelReason);
      setIsSaving(false);
      if (!result.success) {
        toast.error(result.error || "Erreur lors de l'annulation de la liquidation.");
        return;
      }
      toast.success("Liquidation annulee avec succes.");
      setIsCancelOpen(false);
      loadData(currentPage, debouncedSearch);
    } catch (err: any) {
      setIsSaving(false);
      const msg = err?.message || "Une erreur réseau est survenue. Veuillez réessayer.";
      toast.error(msg);
      console.error(err);
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

      {/* ─── Avertissements limite d'articles par rôle ─── */}
      {activeRoles
        .filter((r) => r.dernier_article >= 93)
        .map((r) => {
          const isBlocked = r.dernier_article >= 100;
          return (
            <div
              key={r.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                isBlocked
                  ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300"
                  : "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300"
              }`}
            >
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                {isBlocked ? (
                  <>
                    <span className="font-bold">Rôle #{r.numero_role} – {r.commune} bloqué :</span>{" "}
                    Le numéro d&apos;article actuel a atteint sa limite de <strong>100/100</strong>.
                    Vous devez <strong>clôturer ce rôle</strong> et en créer un nouveau avant de pouvoir valider.
                  </>
                ) : (
                  <>
                    <span className="font-bold">Rôle #{r.numero_role} – {r.commune} :</span>{" "}
                    Il reste seulement <strong>{100 - r.dernier_article} article(s)</strong> disponibles sur 100.
                    Les articles dépassant 100 seront automatiquement transférés vers un nouveau rôle.
                  </>
                )}
              </div>
            </div>
          );
        })}

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

      {/* VUE MOBILE (Cartes) */}
      <div className="md:hidden space-y-3">
        {filteredLiquidations.map((liq) => {
          const c = getContribuable(liq);
          const activeRole = activeRoles.find((r) => r.commune.toLowerCase() === c.commune.toLowerCase());
          const isBlocked = activeRole && activeRole.dernier_article >= 100;

          return (
            <div
              key={liq.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.nom_prenoms}</h3>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">IFU/NPI: {c.ifu_npi}</div>
                </div>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  {liq.reference_liq}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                <div><span className="font-medium text-gray-700 dark:text-gray-300">Tél:</span> {c.telephone || "-"}</div>
                <div><span className="font-medium text-gray-700 dark:text-gray-300">Date:</span> {new Date(liq.created_at).toLocaleDateString("fr-FR")}</div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                <button
                  onClick={() => handleValidate(liq.id)}
                  disabled={isBlocked}
                  className={`font-medium py-1.5 px-3 rounded-lg text-xs transition ${
                    isBlocked
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed opacity-60"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  Valider
                </button>
                <button
                  onClick={() => handleOpenEdit(liq)}
                  className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-3 rounded-lg text-xs transition"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Modifier
                </button>
                <button
                  onClick={() => handleOpenCancel(liq)}
                  className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-3 rounded-lg text-xs transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Annuler
                </button>
                <button
                  onClick={() => handleDownloadPdf(liq)}
                  disabled={pdfLoadingId === liq.id}
                  className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-medium py-1.5 px-3 rounded-lg text-xs transition"
                >
                  {pdfLoadingId === liq.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  PDF
                </button>
              </div>
            </div>
          );
        })}
        {filteredLiquidations.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            {searchQuery ? "Aucune liquidation ne correspond à votre recherche." : "Aucune liquidation en attente."}
          </div>
        )}
      </div>

      {/* VUE DESKTOP (Tableau) */}
      <div className="hidden md:block overflow-x-auto">
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
              const c = getContribuable(liq);
              const activeRole = activeRoles.find((r) => r.commune.toLowerCase() === c.commune.toLowerCase());
              const isBlocked = activeRole && activeRole.dernier_article >= 100;

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
                        disabled={isBlocked}
                        className={`font-medium py-1.5 px-3 rounded text-xs transition transform ${
                          isBlocked
                            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed opacity-60"
                            : "bg-blue-600 hover:bg-blue-700 text-white hover:scale-105"
                        }`}
                        title={
                          isBlocked
                            ? "Le rôle actuel est complet (100 articles). Veuillez le clôturer avant de valider."
                            : "Valider la liquidation"
                        }
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
                      onChange={(e) => setEditFormData({ ...editFormData, commune: e.target.value, arrondissement: "" })}
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
                      <option value="NON_BATI">Non bâti / FNB</option>
                      <option value="BATI">F. Bâti / FB</option>
                    </select>
                  </div>

                  {/* Superficie (FNB seulement) */}
                  {editFormData.typeBien === "NON_BATI" && (
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
                  )}

                  {/* Valeur locative */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {editFormData.typeBien === "BATI" ? "Valeur Locative / VL (FCFA) *" : "Valeur administrative (VL) (Fixe)"}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={editFormData.typeBien === "NON_BATI"}
                        value={editFormData.valeurLocative}
                        onChange={(e) => setEditFormData({ ...editFormData, valeurLocative: Number(e.target.value) || "" })}
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
                  {editFormData.typeBien === "NON_BATI" && canApplyExo && (
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

                {/* Champs supplémentaires FB */}
                {editFormData.typeBien === "BATI" && (
                  <div className="mt-4 space-y-3">
                    {/* Description bâtiment */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Description du bâtiment (TFU/FB)</label>
                      <input
                        type="text"
                        value={editFormData.description ?? ""}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        placeholder="Ex: 1BAT DE 1P X 6 SISE A ..."
                        className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    {/* Checkbox En Location */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30">
                      <input
                        type="checkbox"
                        id="editIsLoue"
                        checked={editFormData.isLoue ?? false}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          isLoue: e.target.checked,
                          valeurIrf: e.target.checked ? editFormData.valeurIrf : "",
                        })}
                        className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="editIsLoue" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                        Batiment en location
                        <span className="ml-1 text-xs font-normal text-gray-400">(IRF Micro Foncier + P-ORTB)</span>
                      </label>
                    </div>

                    {/* Valeur IRF conditionnelle */}
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
                          onChange={(e) => setEditFormData({ ...editFormData, valeurIrf: e.target.value === "" ? "" : Number(e.target.value) })}
                          placeholder="Ex: 216 000"
                          className="w-full px-3.5 py-2 bg-white dark:bg-gray-900/50 border border-blue-300 dark:border-blue-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          IRF = Valeur IRF × 12% — Exercice : {editFormData.startYear - 1}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pied de formulaire */}
              {editError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 font-medium">{editError}</p>
                </div>
              )}
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

      {/* MODALE D'ANNULATION — Double confirmation par saisie de référence */}
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
                  Référence : <strong className="font-mono text-gray-800 dark:text-gray-200">{selectedLiquidation.reference_liq}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-xs text-red-700 dark:text-red-400">
                ⚠️ Cette action est <strong>définitive et irréversible</strong>. La liquidation passera au statut <strong>ANNULÉ</strong> et ne pourra plus être validée pour paiement.
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Motif de l'annulation <span className="text-red-500">*</span>
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

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Confirmez en saisissant la référence <span className="font-mono text-red-600 dark:text-red-400">{selectedLiquidation.reference_liq}</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cancelConfirmRef}
                  onChange={(e) => setCancelConfirmRef(e.target.value)}
                  placeholder={selectedLiquidation.reference_liq}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-400"
                />
                {cancelConfirmRef && cancelConfirmRef !== selectedLiquidation.reference_liq && (
                  <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">La référence saisie ne correspond pas.</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsCancelOpen(false); setCancelConfirmRef(""); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !cancelReason.trim() || cancelConfirmRef !== selectedLiquidation.reference_liq}
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded-lg transition"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmer l'annulation définitive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: CONFIRMATION SPLIT ARTICLES */}
      {confirmSplit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-amber-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Répartition des articles
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cette validation va répartir les <strong>{confirmSplit.required}</strong> articles de l'avis :
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{confirmSplit.placesCurrent} article(s) dans le rôle actuel <strong>#{confirmSplit.roleNum}</strong> (clôturé à 100).</li>
                <li>{confirmSplit.placesNext} article(s) dans le rôle suivant <strong>#{confirmSplit.roleNum + 1}</strong>.</li>
              </ul>
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSplit(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  validatePayment(confirmSplit.liqId).then(() => {
                    toast.success("Paiement valide, avis de recouvrement généré.");
                    fetchAllRoles()
                      .then((roles) => setActiveRoles(roles.filter((r) => r.status === "ACTIF")))
                      .catch(console.error);
                    loadData(currentPage);
                    setConfirmSplit(null);
                  }).catch(e => {
                    console.error(e);
                    toast.error("Erreur lors de la validation.");
                    setConfirmSplit(null);
                  });
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
              >
                Confirmer la validation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
