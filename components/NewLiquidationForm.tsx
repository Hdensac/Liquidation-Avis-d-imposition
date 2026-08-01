"use client";

import React, { useState, useMemo } from "react";
import { TaxpayerInput, LiquidationCalculations, TaxExercise } from "@/types/liquidation";
import { TaxForm } from "@/components/TaxForm";
import { LiquidationPreview } from "@/components/LiquidationPreview";
import { ExportButtons } from "@/components/ExportButtons";
import { createLiquidation } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "./useToast";
import { Send, FileCheck2 } from "lucide-react";

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

  const calculations: LiquidationCalculations = useMemo(() => {
    const surf = typeof formData.superficie === "number" ? formData.superficie : 0;
    const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;
    const communeStr = formData.commune ? formData.commune.toUpperCase() : "";
    const arrStr = formData.arrondissement ? formData.arrondissement.toUpperCase() : "";
    const quartStr = formData.quartier ? formData.quartier.toUpperCase() : "";
    const locationStr = [communeStr, arrStr, quartStr].filter(Boolean).join("/");
    const adresseDescription = locationStr
      ? `PARCELLE DE ${surf} m2 SISE A ${locationStr}`
      : `PARCELLE DE ${surf} m2`;
    const baseImposable = surf * valeurLocative;
    const exercises: TaxExercise[] = [];
    let totalDu = 0;
    const startYear = typeof formData.startYear === "number" && formData.startYear > 1900 ? formData.startYear : 2023;
    for (let i = 0; i < 4; i++) {
      const year = startYear + i;
      const taux = i === 0 ? 0.04 : 0.05;
      const droitSimple = baseImposable * taux;
      totalDu += droitSimple;
      exercises.push({ year, taxNature: "TFU/FNB", description: adresseDescription, baseImposable, taux, droitSimple });
    }
    return { surf, valeurLocative, adresseDescription, exercises, totalDu };
  }, [formData]);

  const handleSave = async () => {
    if (!formData.fullname || !formData.commune) {
      toast.error("Veuillez remplir au moins le nom et la commune.");
      return;
    }
    setLoading(true);
    try {
      await createLiquidation(formData);
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
      <TaxForm formData={formData} onChange={setFormData} onReset={handleReset} />
      <div className="no-print">
        <ExportButtons formData={formData} calculations={calculations} previewElementId="liquidation-document" />
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] shadow-lg"
      >
        <Send size={18} />
        {loading ? "Enregistrement..." : "Enregistrer & Mettre en attente de paiement"}
      </button>
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print px-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Apercu en temps reel de la fiche officielle</h2>
          <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">Format A4 Imprimable</span>
        </div>
        <div className="overflow-x-auto pb-8">
          <LiquidationPreview formData={formData} calculations={calculations} />
        </div>
      </div>
    </div>
  );
}

