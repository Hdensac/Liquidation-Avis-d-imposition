"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fetchPendingLiquidationsPaginated, validatePayment } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "./useToast";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";
import { LiquidationPreview } from "@/components/LiquidationPreview";
import { generatePDFFromElement } from "@/utils/pdfGenerator";
import { FileText, Loader2, Search, X } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import type { TaxpayerInput } from "@/types/liquidation";

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
  valeur_locative: number;
  start_year: number;
  contribuable: Contribuable[] | Contribuable;
};

function getContribuable(c: Contribuable[] | Contribuable): Contribuable {
  if (Array.isArray(c))
    return c[0] ?? {
      nom_prenoms: "-",
      ifu_npi: "-",
      telephone: "-",
      commune: "",
      arrondissement: "",
      quartier: "",
    };
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
    superficie: Number(liq.superficie) || 0,
    valeurLocative: Number(liq.valeur_locative) || 0,
    startYear: Number(liq.start_year) || new Date().getFullYear(),
  };
}

export default function PendingLiquidationsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ─── état pagination depuis l'URL ───────────────────────────────────────────
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  // ─── état local ─────────────────────────────────────────────────────────────
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [pdfTarget, setPdfTarget] = useState<Liquidation | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const { toast, toasts } = useToast();

  // ─── Chargement (déclenché par page) ────────────────────────────────────────
  const loadData = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const { data, totalCount: total } = await fetchPendingLiquidationsPaginated({ page });
        setLiquidations(data as unknown as Liquidation[]);
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

  // ─── Changement de page → mise à jour URL ────────────────────────────────────
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
    setSearchQuery("");
  };

  // ─── Recherche → reset page 1 ────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (currentPage !== 1) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  // ─── Filtre côté client sur la page courante ─────────────────────────────────
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

  // ─── PDF helpers ──────────────────────────────────────────────────────────────
  const pdfFormData = useMemo(
    () => (pdfTarget ? liquidationToFormData(pdfTarget) : null),
    [pdfTarget]
  );
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

  const handleDownloadPdf = (liquidation: Liquidation) => {
    if (pdfLoadingId) return;
    setPdfLoadingId(liquidation.id);
    setPdfTarget(liquidation);
  };

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
          {filteredLiquidations.length} résultat(s) sur cette page
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
                  <td className="px-4 py-2">
                    {new Date(liq.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => handleValidate(liq.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded transition transform hover:scale-105"
                      >
                        Valider le paiement
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(liq)}
                        disabled={pdfLoadingId === liq.id}
                        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-medium py-1 px-3 rounded transition transform hover:scale-105"
                      >
                        {pdfLoadingId === liq.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                        Telecharger PDF
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
                    ? "Aucune liquidation ne correspond à votre recherche."
                    : "Aucun paiement en attente."}
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

      {/* Rendu PDF caché */}
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
    </div>
  );
}
