"use client";

import React, { useState, useMemo } from "react";
import { TaxpayerInput } from "@/types/liquidation";
import { TaxForm } from "@/components/TaxForm";
import { LiquidationPreview } from "@/components/LiquidationPreview";
import { ExportButtons } from "@/components/ExportButtons";
import { createLiquidation } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "./useToast";
import { Send, FileCheck2 } from "lucide-react";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";

const EMPTY_FORM: TaxpayerInput = {
  fullname: "",
  ifuNpi: "",
  phone: "",
  commune: "",
  arrondissement: "",
  quartier: "",
  superficie: "",
  valeurLocative: "",
  startYear: 2023,
};

interface NewLiquidationFormProps {
  canApplyExoneration: boolean;
}

export default function NewLiquidationForm({ canApplyExoneration }: NewLiquidationFormProps) {
  const [formData, setFormData] = useState<TaxpayerInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const { toast, toasts } = useToast();

  const handleReset = () => setFormData(EMPTY_FORM);

  const effectiveFormData = useMemo(
    () => (canApplyExoneration ? formData : { ...formData, superficieImposable: "" }),
    [canApplyExoneration, formData]
  );

  const calculations = useMemo(() => buildLiquidationCalculations(effectiveFormData), [effectiveFormData]);

  const handleSave = async () => {
    if (!effectiveFormData.fullname || !effectiveFormData.commune) {
      toast.error("Veuillez remplir au moins le nom et la commune.");
      return;
    }
    setLoading(true);
    try {
      await createLiquidation(effectiveFormData);
      toast.success("Liquidation enregistree - en attente de paiement.");
      handleReset();
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} />
      <div className="flex items-center gap-2 bg-slate-800 text-white border border-slate-700 px-4 py-2 rounded-xl text-xs font-mono w-fit">
        <FileCheck2 className="w-4 h-4 text-emerald-400" />
        <span>Format conforme DGI</span>
      </div>
      <TaxForm
        formData={effectiveFormData}
        onChange={setFormData}
        onReset={handleReset}
        canApplyExoneration={canApplyExoneration}
      />
      <div className="no-print">
        <ExportButtons formData={effectiveFormData} calculations={calculations} previewElementId="liquidation-document" />
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg"
      >
        <Send size={18} />
        {loading ? "Enregistrement..." : "Enregistrer & Mettre en attente de paiement"}
      </button>
      {/* Offscreen element kept for PDF generation */}
      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0" aria-hidden="true">
        <LiquidationPreview formData={effectiveFormData} calculations={calculations} />
      </div>
    </div>
  );
}