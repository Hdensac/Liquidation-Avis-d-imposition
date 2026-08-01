"use client";

// components/PendingLiquidationsTable.tsx
import React, { useEffect, useState } from "react";
import { fetchPendingLiquidations, validatePayment } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "./useToast";

type Liquidation = {
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

export default function PendingLiquidationsTable() {
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast, toasts } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchPendingLiquidations({});
      setLiquidations(data as Liquidation[]);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des liquidations en attente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleValidate = async (id: string) => {
    try {
      await validatePayment(id);
      toast.success("Paiement validé, avis de recouvrement généré.");
      // Refresh list
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la validation du paiement.");
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
            <th className="px-4 py-2 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {liquidations.map((liq) => (
            <tr key={liq.id} className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              <td className="px-4 py-2">{liq.contribuable.ifu_npi}</td>
              <td className="px-4 py-2">{liq.contribuable.nom_prenoms}</td>
              <td className="px-4 py-2">{liq.contribuable.telephone}</td>
              <td className="px-4 py-2">{liq.reference_liq}</td>
              <td className="px-4 py-2">{new Date(liq.created_at).toLocaleDateString()}</td>
              <td className="px-4 py-2 text-center">
                <button
                  onClick={() => handleValidate(liq.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-3 rounded transition transform hover:scale-105"
                >
                  Valider le paiement
                </button>
              </td>
            </tr>
          ))}
          {liquidations.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-2 text-center text-gray-500">
                Aucun paiement en attente.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
