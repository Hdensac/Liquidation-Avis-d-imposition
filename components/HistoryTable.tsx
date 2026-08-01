"use client";

// components/HistoryTable.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast, ToastContainer } from "./useToast";

type Recouvrement = {
  id: string;
  reference_liq: string;
  status: string;
  created_at: string;
  contribuable: {
    nom_prenoms: string;
    ifu_npi: string;
    telephone: string;
  };
};

export default function HistoryTable() {
  const [records, setRecords] = useState<Recouvrement[]>([]);
  const [loading, setLoading] = useState(false);
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
      setRecords(data as Recouvrement[]);
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
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => (
            <tr key={rec.id} className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              <td className="px-4 py-2">{rec.contribuable.ifu_npi}</td>
              <td className="px-4 py-2">{rec.contribuable.nom_prenoms}</td>
              <td className="px-4 py-2">{rec.contribuable.telephone}</td>
              <td className="px-4 py-2">{rec.reference_liq}</td>
              <td className="px-4 py-2">{new Date(rec.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-center">{rec.status}</td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-2 text-center text-gray-500">
                Aucun historique disponible.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
