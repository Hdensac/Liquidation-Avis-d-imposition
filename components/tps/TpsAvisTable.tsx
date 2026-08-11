"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fetchAvisValidesTps } from "@/actions/tpsActions";
import { useToast, ToastContainer } from "@/components/useToast";
import { TpsPreview } from "./TpsPreview";
import { generatePDFFromElement } from "@/utils/pdfGenerator";
import { FileText, Loader2, Search, X, Calendar, Download } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

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
  role: Role;
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
};

export default function TpsAvisTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const [avisList, setAvisList] = useState<LiquidationTps[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast, toasts } = useToast();

  // PDF Generation States
  const [pdfTarget, setPdfTarget] = useState<LiquidationTps | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  const loadData = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const { data, totalCount: total } = await fetchAvisValidesTps({ page });
        setAvisList((data ?? []) as LiquidationTps[]);
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

  const handleDownloadPdf = (liq: LiquidationTps) => {
    if (pdfLoadingId) return;
    setPdfLoadingId(liq.id);
    setPdfTarget(liq);
  };

  const hiddenDocumentId = pdfTarget ? `tps-document-${pdfTarget.id}` : "";

  // Effect to perform the DOM to PDF render
  useEffect(() => {
    if (!pdfTarget) return;
    const filename = `Avis_TPS_${pdfTarget.reference_tps}.pdf`;

    const timer = window.setTimeout(async () => {
      try {
        await generatePDFFromElement(hiddenDocumentId, filename);
        toast.success("Avis de mise en recouvrement télécharge avec succès.");
      } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        toast.error("Impossible de générer le PDF de cet avis.");
      } finally {
        setPdfLoadingId(null);
        setPdfTarget(null);
      }
    }, 150);

    return () => window.clearTimeout(timer);
  }, [pdfTarget, hiddenDocumentId, toast]);

  // Extract variables for the target PDF rendering
  const pdfFormData = useMemo(() => {
    if (!pdfTarget) return null;
    return {
      nomRaisonSociale: pdfTarget.contribuable.nom_raison_sociale,
      ifuNc: pdfTarget.contribuable.ifu_nc,
      telephone: pdfTarget.contribuable.telephone,
      commune: pdfTarget.contribuable.commune,
      arrondissement: pdfTarget.contribuable.arrondissement,
      quartier: pdfTarget.contribuable.quartier,
      localisation: pdfTarget.contribuable.localisation,
      activite: pdfTarget.activite,
      montantAutresActivites: pdfTarget.montant_autres_activites,
      acomptesPayes: pdfTarget.acomptes_payes,
      startYear: pdfTarget.start_year,
    };
  }, [pdfTarget]);

  const pdfArticlesStr = useMemo(() => {
    if (!pdfTarget || !pdfTarget.articles || pdfTarget.articles.length === 0) return "A Générer";
    const nums = pdfTarget.articles.map((art) => art.numero_article);
    return nums.sort((a, b) => a - b).join(", ");
  }, [pdfTarget]);

  const pdfRoleNum = useMemo(() => {
    if (!pdfTarget || !pdfTarget.articles || pdfTarget.articles.length === 0) return "1";
    return pdfTarget.articles[0].role?.numero_role ?? "1";
  }, [pdfTarget]);

  const pdfDateStr = useMemo(() => {
    if (!pdfTarget || !pdfTarget.validated_at) return "";
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(pdfTarget.validated_at).toLocaleDateString("fr-FR", options);
  }, [pdfTarget]);

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

      {/* RENDER DÉDIÉ CACHÉ DU PDF PENDANT LE TÉLÉCHARGEMENT */}
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

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left">IFU / NC</th>
                <th className="px-6 py-4 text-left">Raison Sociale</th>
                <th className="px-6 py-4 text-left">Articles</th>
                <th className="px-6 py-4 text-left">Rôle Communal</th>
                <th className="px-6 py-4 text-right">Impôt dû</th>
                <th className="px-6 py-4 text-right">Payé</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {filteredAvisList.map((liq) => {
                const arts = liq.articles || [];
                const artNumbers = arts.map((a) => a.numero_article).sort((a, b) => a - b).join(", ");
                const roleName = arts[0]?.role
                  ? `${arts[0].role.commune} Rôle ${arts[0].role.numero_role} (${arts[0].role.annee})`
                  : "-";

                return (
                  <tr key={liq.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-600">
                      {liq.contribuable?.ifu_nc}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {liq.contribuable?.nom_raison_sociale}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-700 font-mono text-xs px-2 py-1 rounded border border-slate-200">
                        {artNumbers || "A Générer"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">
                      {roleName}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold">
                      {liq.impot_du.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-emerald-600">
                      {liq.acomptes_payes.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
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
              totalItems={totalCount}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
