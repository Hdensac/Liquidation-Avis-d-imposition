"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast, ToastContainer } from "./useToast";
import { fetchAvisRecouvrementDetails } from "@/actions/liquidationActions";
import { generateAvisRecouvrementPdf } from "@/utils/avisPdfGenerator";
import { Download, Loader2 } from "lucide-react";

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
};

function getContribuable(c: Contribuable[] | Contribuable): Contribuable {
  if (Array.isArray(c)) return c[0] ?? { nom_prenoms: "-", ifu_npi: "-", telephone: "-" };
  return c;
}

export default function HistoryTable() {
  const [records, setRecords] = useState<Recouvrement[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { toast, toasts } = useToast();

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("liquidations")
        .select(
          "id, reference_liq, status, created_at, contribuable:contribuables (nom_prenoms, ifu_npi, telephone)"
        )
        .eq("status", "PAYE");
      if (error) throw error;
      setRecords(data as unknown as Recouvrement[]);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement de l'historique.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDownloadAvis = async (liquidationId: string, reference: string) => {
    if (actionLoadingId) return;
    setActionLoadingId(liquidationId);
    try {
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

  if (loading) return <p className="text-center">Chargement...</p>;

  return (
    <div className="overflow-x-auto">
      <ToastContainer toasts={toasts} />
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
          {records.map((rec) => {
            const c = getContribuable(rec.contribuable);
            const isActionLoading = actionLoadingId === rec.id;
            return (
              <tr key={rec.id} className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <td className="px-4 py-2">{c.ifu_npi}</td>
                <td className="px-4 py-2">{c.nom_prenoms}</td>
                <td className="px-4 py-2">{c.telephone}</td>
                <td className="px-4 py-2">{rec.reference_liq}</td>
                <td className="px-4 py-2">{new Date(rec.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-center">{rec.status}</td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => handleDownloadAvis(rec.id, rec.reference_liq)}
                    disabled={isActionLoading}
                    className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white font-medium py-1.5 px-3 rounded transition transform hover:scale-105"
                  >
                    {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Télécharger l'Avis PDF
                  </button>
                </td>
              </tr>
            );
          })}
          {records.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-2 text-center text-gray-500">
                Aucun historique disponible.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}