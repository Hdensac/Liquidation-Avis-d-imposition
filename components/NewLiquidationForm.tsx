"use client";

// components/NewLiquidationForm.tsx
import React, { useState } from "react";
import TaxForm from "@/components/TaxForm";
import { createLiquidation } from "@/actions/liquidationActions";
import { TaxpayerInput } from "@/types/liquidation";
import { useToast, ToastContainer } from "./useToast";

export default function NewLiquidationForm() {
  const [loading, setLoading] = useState(false);
  const { toast, toasts } = useToast();

  const handleSubmit = async (data: TaxpayerInput) => {
    setLoading(true);
    try {
      await createLiquidation(data);
      toast.success("Liquidation enregistrée et en attente de paiement.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création de la liquidation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <ToastContainer toasts={toasts} />
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Nouvelle liquidation
      </h2>
      <TaxForm onSubmit={handleSubmit} disabled={loading} />
    </div>
  );
}
