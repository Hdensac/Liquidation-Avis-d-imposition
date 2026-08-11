"use client";

import React, { useState } from "react";
import { TpsForm } from "@/components/tps/TpsForm";
import { TpsPreview } from "@/components/tps/TpsPreview";
import { createLiquidationTps } from "@/actions/tpsActions";
import { buildTpsCalculations, TpsInput } from "@/utils/tpsCalculations";
import { useToast, ToastContainer } from "@/components/useToast";
import { Eye, EyeOff } from "lucide-react";

const DEFAULT_FORM: TpsInput = {
  nomRaisonSociale: "",
  ifuNc: "",
  telephone: "",
  commune: "",
  arrondissement: "",
  quartier: "",
  localisation: "",
  activite: "",
  montantAutresActivites: 0,
  acomptesPayes: 0,
  startYear: new Date().getFullYear(),
};

export default function TpsNewPage() {
  const [formData, setFormData] = useState<TpsInput>(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast, toasts } = useToast();

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await createLiquidationTps(formData);
      toast.success(`Fiche TPS enregistrée ! Référence : ${result.reference_tps}`);
      setFormData(DEFAULT_FORM);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erreur lors de l'enregistrement de la fiche TPS.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculations = buildTpsCalculations({
    montantAutresActivites: formData.montantAutresActivites,
    acomptesPayes: formData.acomptesPayes,
    startYear: formData.startYear,
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4">
      <ToastContainer toasts={toasts} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouvelle fiche TPS</h1>
          <p className="text-sm text-slate-500 mt-1">
            Saisissez les informations du contribuable pour créer un avis de mise en recouvrement TPS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm hover:shadow transition"
        >
          {showPreview ? (
            <>
              <EyeOff className="w-4 h-4" />
              Masquer la prévisualisation
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              Prévisualiser l'avis
            </>
          )}
        </button>
      </div>

      <TpsForm
        formData={formData}
        onChange={setFormData}
        onReset={() => setFormData(DEFAULT_FORM)}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      {showPreview && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">
            Prévisualisation de l'avis TPS
          </h2>
          <div className="overflow-x-auto">
            <TpsPreview
              formData={formData}
              articleNumbers="À générer lors de la validation"
              roleNumber="—"
              documentId="tps-preview-new"
            />
          </div>
        </div>
      )}
    </div>
  );
}
