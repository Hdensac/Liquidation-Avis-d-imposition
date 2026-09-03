"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Search,
  Users,
  Building2,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Eye,
  X,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Filter,
  RefreshCw
} from "lucide-react";
import { fetchTaxpayers, getTaxpayerDetails, type TaxpayerItem, type TaxpayerDetail } from "@/actions/taxpayerActions";
import { generateTaxpayerAttestationPdf } from "@/utils/taxpayerAttestationPdf";
import Pagination from "@/components/Pagination";

export default function TaxpayersClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [taxpayers, setTaxpayers] = useState<TaxpayerItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalUpToDate, setTotalUpToDate] = useState(0);
  const [totalDebtors, setTotalDebtors] = useState(0);
  const [totalArrears, setTotalArrears] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filtre par statut (TOUS, A_JOUR, DEBITEUR)
  const [statusFilter, setStatusFilter] = useState<"TOUS" | "A_JOUR" | "DEBITEUR">("TOUS");

  // Contribuable sélectionné pour la fiche détaillée (modal)
  const [selectedTaxpayerKey, setSelectedTaxpayerKey] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<TaxpayerDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"patrimoine" | "historique" | "financier">("patrimoine");

  const [isPending, startTransition] = useTransition();

  // Debounce de recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Chargement des contribuables
  const loadTaxpayers = async () => {
    setIsLoading(true);
    try {
      const res = await fetchTaxpayers(debouncedQuery, page, 20);
      setTaxpayers(res.data);
      setTotalCount(res.total);
      setTotalUpToDate(res.totalUpToDate);
      setTotalDebtors(res.totalDebtors);
      setTotalArrears(res.totalArrears);
    } catch (err) {
      console.error("Erreur chargement contribuables:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTaxpayers();
  }, [debouncedQuery, page]);

  // Chargement du détail d'un contribuable
  useEffect(() => {
    if (!selectedTaxpayerKey) {
      setDetailData(null);
      return;
    }
    const loadDetail = async () => {
      setIsDetailLoading(true);
      try {
        const details = await getTaxpayerDetails(selectedTaxpayerKey);
        setDetailData(details);
      } catch (err) {
        console.error("Erreur chargement détails contribuable:", err);
      } finally {
        setIsDetailLoading(false);
      }
    };
    loadDetail();
  }, [selectedTaxpayerKey]);

  // Filtrage local par statut de paiement
  const filteredTaxpayers = taxpayers.filter((t) => {
    if (statusFilter === "A_JOUR") return t.status === "A_JOUR";
    if (statusFilter === "DEBITEUR") return t.status === "SOLDE_DEBITEUR";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* En-tête de la page */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
            <Users size={18} />
            <span>Répertoire Fiscal Centralisé</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Répertoire Unique des Contribuables & Foncier
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consultez le patrimoine foncier TFU, les activités TPS et l'état des recouvrements par IFU ou Nom.
          </p>
        </div>

        <button
          onClick={loadTaxpayers}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Cartes statistiques globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Contribuables</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Users size={20} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {totalCount.toLocaleString("fr-FR")}
          </div>
          <span className="text-xs text-slate-500 mt-1 inline-block">Registres TFU & TPS</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">À jour (Solde 0 F)</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {totalUpToDate.toLocaleString("fr-FR")}
          </div>
          <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 inline-block">Aucun arriéré dû</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contribuables Débiteurs</span>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {totalDebtors.toLocaleString("fr-FR")}
          </div>
          <span className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1 inline-block">Avis impayés en cours</span>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Arriérés</span>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
              <FileText size={20} />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-2 truncate">
            {totalArrears.toLocaleString("fr-FR")} F CFA
          </div>
          <span className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 inline-block">Montant total à recouvrer</span>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par IFU/NPI, Nom, Téléphone, Commune..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter size={16} className="text-slate-400 flex-shrink-0" />
          <button
            onClick={() => setStatusFilter("TOUS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === "TOUS"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Tous ({totalCount})
          </button>

          <button
            onClick={() => setStatusFilter("A_JOUR")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === "A_JOUR"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            À jour ({totalUpToDate})
          </button>

          <button
            onClick={() => setStatusFilter("DEBITEUR")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              statusFilter === "DEBITEUR"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Débiteurs ({totalDebtors})
          </button>
        </div>
      </div>

      {/* Tableau des contribuables */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-4 px-6">Contribuable / IFU</th>
                <th className="py-4 px-6">Contact & Localisation</th>
                <th className="py-4 px-6">Patrimoine / Activités</th>
                <th className="py-4 px-6 text-right">Total Émis</th>
                <th className="py-4 px-6 text-center">Situation Fiscale</th>
                <th className="py-4 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm text-slate-700 dark:text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Chargement du répertoire des contribuables...
                  </td>
                </tr>
              ) : filteredTaxpayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Aucun contribuable trouvé pour cette recherche.
                  </td>
                </tr>
              ) : (
                filteredTaxpayers.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition cursor-pointer"
                    onClick={() => setSelectedTaxpayerKey(item.id)}
                  >
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </div>
                      <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                        IFU : {item.ifu}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <Phone size={13} className="text-slate-400" />
                        <span>{item.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                        <span>
                          {item.communes && item.communes.length > 1
                            ? `Communes (${item.communes.length}) : ${item.communes.join(", ")}`
                            : `Commune : ${item.communes?.[0] || item.commune || "—"}`}
                        </span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-xs">
                        {item.totalProperties > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                            <Building2 size={12} />
                            {item.totalProperties} bien(s) TFU
                          </span>
                        )}
                        {item.totalActivities > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                            <Briefcase size={12} />
                            {item.totalActivities} activité(s) TPS
                          </span>
                        )}
                        {item.totalProperties === 0 && item.totalActivities === 0 && (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6 text-right font-medium text-slate-900 dark:text-white">
                      {item.totalAmountDues.toLocaleString("fr-FR")} F CFA
                    </td>

                    <td className="py-4 px-6 text-center">
                      {item.status === "A_JOUR" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <CheckCircle2 size={13} />
                          À JOUR (0 F)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <AlertCircle size={13} />
                          ARRIÉRÉ: {item.balanceDue.toLocaleString("fr-FR")} F
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTaxpayerKey(item.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-lg text-xs font-medium transition"
                      >
                        <Eye size={14} />
                        <span>Fiche</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Control de Pagination */}
        {totalCount > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Affichage de <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredTaxpayers.length}</span> sur <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount}</span> contribuable(s)
            </div>
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={20}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* MODAL FICHE SYNTHÉTIQUE CONTRIBUABLE */}
      {selectedTaxpayerKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                  Fiche Synthétique du Contribuable
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {detailData ? detailData.name : "Chargement..."}
                </h2>
                {detailData && (
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                    <span className="font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200 font-semibold">
                      IFU: {detailData.ifu}
                    </span>
                    <span>Tél: {detailData.phone}</span>
                    <span>
                      Commune(s) d'implantation: {detailData.communes && detailData.communes.length > 0 ? detailData.communes.join(", ") : detailData.commune}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {detailData && (
                  <button
                    onClick={() => generateTaxpayerAttestationPdf(detailData)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    <Download size={14} />
                    <span>Attestation PDF</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedTaxpayerKey(null)}
                  className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-500 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {isDetailLoading || !detailData ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                Chargement complet des données du contribuable...
              </div>
            ) : (
              <div className="p-6 overflow-y-auto space-y-6 flex-1">

                {/* Résumé régularité fiscale */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  detailData.balanceDue === 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-300"
                    : "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800/50 dark:text-rose-300"
                }`}>
                  <div className="flex items-center gap-3">
                    {detailData.balanceDue === 0 ? (
                      <ShieldCheck className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-8 h-8 text-rose-600 flex-shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm">
                        {detailData.balanceDue === 0
                          ? "Situation Fiscale Régulière — À Jour"
                          : "Attention : Solde Débiteur En Souffrance"}
                      </div>
                      <div className="text-xs opacity-80 mt-0.5">
                        {detailData.balanceDue === 0
                          ? "Le contribuable ne possède aucun arriéré de liquidation sur l'ensemble des exercices."
                          : `Reste à payer : ${detailData.balanceDue.toLocaleString("fr-FR")} F CFA sur un total émis de ${detailData.totalLiquidated.toLocaleString("fr-FR")} F CFA.`}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-xs uppercase font-semibold opacity-70">Arriérés Dûs</div>
                    <div className="text-lg font-extrabold">
                      {detailData.balanceDue.toLocaleString("fr-FR")} F CFA
                    </div>
                  </div>
                </div>

                {/* Navigation par Onglets de la fiche */}
                <div className="border-b border-slate-200 dark:border-slate-700 flex items-center gap-4">
                  <button
                    onClick={() => setActiveTab("patrimoine")}
                    className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                      activeTab === "patrimoine"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    <Building2 size={16} />
                    <span>Patrimoine & Établissements ({detailData.properties.length + detailData.activities.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("historique")}
                    className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                      activeTab === "historique"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    <FileText size={16} />
                    <span>Historique Liquidations ({detailData.liquidations.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("financier")}
                    className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                      activeTab === "financier"
                        ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                        : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    <CheckCircle2 size={16} />
                    <span>Synthèse Financière</span>
                  </button>
                </div>

                {/* ONGLET 1 : PATRIMOINE & ÉTABLISSEMENTS */}
                {activeTab === "patrimoine" && (
                  <div className="space-y-6">
                    {/* Section TFU */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <Building2 size={16} className="text-indigo-600" />
                        <span>Biens Fonciers TFU (Foncier Bâti & Non Bâti)</span>
                      </h3>
                      {detailData.properties.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                          Aucun bien foncier TFU enregistré sous cet IFU/Nom.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {detailData.properties.map((p, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs space-y-1.5">
                              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                <span>{p.typeBien === "BATI" ? "Foncier Bâti (FB)" : "Foncier Non Bâti (FNB)"}</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-mono">{p.referenceLiq}</span>
                              </div>
                              <div className="text-slate-600 dark:text-slate-300">
                                <span className="font-medium">Localisation :</span> {p.commune}, {p.arrondissement}, {p.quartier}
                              </div>
                              <div className="text-slate-600 dark:text-slate-300">
                                <span className="font-medium">Superficie :</span> {p.superficie.toLocaleString("fr-FR")} m² (Imposable: {p.superficieImposable.toLocaleString("fr-FR")} m²)
                              </div>
                              {p.valeurLocative > 0 && (
                                <div className="text-slate-600 dark:text-slate-300">
                                  <span className="font-medium">Valeur Locative :</span> {p.valeurLocative.toLocaleString("fr-FR")} F CFA
                                </div>
                              )}
                              {p.description && (
                                <div className="text-slate-500 dark:text-slate-400 italic">
                                  "{p.description}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Section TPS */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <Briefcase size={16} className="text-purple-600" />
                        <span>Établissements & Activités TPS</span>
                      </h3>
                      {detailData.activities.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                          Aucune activité TPS enregistrée sous cet IFU/Nom.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {detailData.activities.map((a, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 text-xs space-y-1.5">
                              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                <span>{a.activite}</span>
                                <span className="text-purple-600 dark:text-purple-400 font-mono">{a.referenceTps}</span>
                              </div>
                              <div className="text-slate-600 dark:text-slate-300">
                                <span className="font-medium">Commune :</span> {a.commune}
                              </div>
                              {a.montantAutresActivites > 0 && (
                                <div className="text-slate-600 dark:text-slate-300">
                                  <span className="font-medium">Autres activités :</span> {a.montantAutresActivites.toLocaleString("fr-FR")} F CFA
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ONGLET 2 : HISTORIQUE DES LIQUIDATIONS */}
                {activeTab === "historique" && (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Référence</th>
                          <th className="py-3 px-4">Exercice</th>
                          <th className="py-3 px-4 text-right">Montant Dû</th>
                          <th className="py-3 px-4 text-center">Statut Paiement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {detailData.liquidations.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                              {new Date(l.created_at).toLocaleDateString("fr-FR")}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                              {l.type}
                            </td>
                            <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                              {l.reference}
                            </td>
                            <td className="py-3 px-4 font-medium">
                              {l.startYear}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                              {l.totalDroits.toLocaleString("fr-FR")} F CFA
                            </td>
                            <td className="py-3 px-4 text-center">
                              {l.status === "PAYE" || l.status === "VALIDE" ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  PAYÉ
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                                  EN ATTENTE
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ONGLET 3 : SYNTHÈSE FINANCIÈRE */}
                {activeTab === "financier" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Total Émis (Liquidations)</span>
                      <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {detailData.totalLiquidated.toLocaleString("fr-FR")} F CFA
                      </div>
                      <span className="text-xs text-slate-400 mt-1 inline-block">Cumul global toutes années</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Total Recouvré (Payé)</span>
                      <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                        {detailData.totalPaid.toLocaleString("fr-FR")} F CFA
                      </div>
                      <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 inline-block">Montants effectivement encaissés</span>
                    </div>

                    <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase">Solde Restant Dû</span>
                      <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                        {detailData.balanceDue.toLocaleString("fr-FR")} F CFA
                      </div>
                      <span className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 inline-block">Montant des arriérés restants</span>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
