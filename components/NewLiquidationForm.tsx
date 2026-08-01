"use client";

// components/NewLiquidationForm.tsx
import React, { useState } from "react";
import { TaxForm } from "@/components/TaxForm";
import { createLiquidation } from "@/actions/liquidationActions";
import { TaxpayerInput } from "@/types/liquidation";
import { useToast, ToastContainer } from "./useToast";
import { Send } from "lucide-react";

const EMPTY_FORM: TaxpayerInput = {
  fullname: "",
  ifuNpi: "",
  phone: "",
  commune: "",
  arrondissement: "",
  quartier: "",
  superficie: "",
  valeurLocative: 300,
  startYear: 2023,
};

export default function NewLiquidationForm() {
  const [formData, setFormData] = useState<TaxpayerInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const { toast, toasts } = useToast();

  const handleReset = () => setFormData(EMPTY_FORM);

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.fullname || !formData.commune) {
      toast.error("Veuillez remplir au moins le nom et la commune.");
      return;
    }
    setLoading(true);
    try {
      await createLiquidation(formData);
      toast.success("Liquidation créée et en attente de paiement ✓");
      handleReset();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la création de la liquidation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <ToastContainer toasts={toasts} />
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Nouvelle liquidation
        </h2>

        <TaxForm
          formData={formData}
          onChange={setFormData}
          onReset={handleReset}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-105 shadow-md"
        >
          <Send size={18} />
          {loading ? "Enregistrement..." : "Enregistrer la liquidation"}
        </button>
      </div>
    </div>
  );
}


