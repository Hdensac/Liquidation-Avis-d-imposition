"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useToast, ToastContainer } from "./useToast";
import { fetchAvisRecouvrementDetails, incrementLiquidationDownloadCount } from "@/actions/liquidationActions";
import { fetchHistoryLiquidationsPaginated } from "@/actions/liquidationActions";
import { generateAvisRecouvrementPdf } from "@/utils/avisPdfGenerator";
import { Download, Loader2, Search, X } from "lucide-react";
import Pagination from "@/components/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

type Contribuable = {
  nom_prenoms: string;
  ifu_npi: string;
  telephone: string;
};

type Recouvrement = {
  id: string;
  reference_liq: string;
  status: string;
  created_at: string;
  contribuable: Contribuable[] | Contribuable;
  download_count?: number;
};

function getContribuable(c: Contribuable[] | Contribuable): Contribuable {
  if (Array.isArray(c)) return c[0] ?? { nom_prenoms: "-", ifu_npi: "-", telephone: "-" };
  return c;
}

export default function HistoryTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ─── état pagination depuis l'URL ───────────────────────────────────────────
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  // ─── état local ─────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<Recouvrement[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { toast, toasts } = useToast();

  // ─── Chargement (déclenché par page) ────────────────────────────────────────
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

  // ─── Changement de page → mise à jour URL ────────────────────────────────────
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
    setSearchQuery(""); // reset recherche lors d'un changement de page
  };

  // ─── Recherche → reset page 1 ────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Si on est sur une page > 1 on revient à la page 1
    if (currentPage !== 1) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  // ─── Filtre côté client sur la page courante ─────────────────────────────────
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

  // ─── Téléchargement PDF ───────────────────────────────────────────────────────
  const handleDownloadAvis = async (liquidationId: string, reference: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(liquidationId);
    try {
      // 1. Incrémenter en BDD
      await incrementLiquidationDownloadCount(liquidationId);
      // 2. Mettre à jour l'état local pour rafraîchir l'affichage immédiatement
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

      {/* Barre de recherche et filtre */}
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

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">IFU/NPI</th>
              <th className="px-4 py-2 text-left">Nom / Prénom</th>
              <th className="px-4 py-2 text-left">Téléphone</th>
              <th className="px-4 py-2 text-left">Référence</th>
              <th className="px-4 py-2 text-left">Créée le</th>
              <th className="px-4 py-2 text-center">Statut</th>
              <th className="px-4 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((rec) => {
              const c = getContribuable(rec.contribuable);
              const isActionLoading = actionLoadingId === rec.id;
              const hasBeenDownloaded = !!(rec.download_count && rec.download_count > 0);
              return (
                <tr
                  key={rec.id}
                  className={`border-b border-gray-300 dark:border-gray-600 transition ${
                    hasBeenDownloaded
                      ? "bg-emerald-50/15 hover:bg-emerald-100/30 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 border-l-4 border-l-emerald-500/70"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <td className="px-4 py-2">{c.ifu_npi}</td>
                  <td className="px-4 py-2">{c.nom_prenoms}</td>
                  <td className="px-4 py-2">{c.telephone}</td>
                  <td className="px-4 py-2 font-mono">{rec.reference_liq}</td>
                  <td className="px-4 py-2">
                    {new Date(rec.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-2 text-center">{rec.status}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleDownloadAvis(rec.id, rec.reference_liq)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-medium py-1.5 px-3 rounded transition transform hover:scale-105"
                      >
                        {isActionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Avis PDF
                      </button>
                      {!hasBeenDownloaded && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-400 font-semibold whitespace-nowrap border border-gray-200 dark:border-gray-700 shadow-sm"
                          title="Jamais téléchargé"
                        >
                          📥 0
                        </span>
                      )}
                      {hasBeenDownloaded && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold whitespace-nowrap border border-emerald-200/50 shadow-sm"
                          title={`${rec.download_count} téléchargement(s)`}
                        >
                          📥 {rec.download_count}
                        </span>
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
    </div>
  );
}
