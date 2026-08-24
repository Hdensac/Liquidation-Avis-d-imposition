"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { TaxpayerInput } from "@/types/liquidation";
import { TaxForm } from "@/components/TaxForm";
import { LiquidationPreview } from "@/components/LiquidationPreview";
import { ExportButtons } from "@/components/ExportButtons";
import { createLiquidation } from "@/actions/liquidationActions";
import { useToast, ToastContainer } from "./useToast";
import { Send, FileCheck2, Save } from "lucide-react";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";

const STORAGE_KEY = "draft_new_liquidation";

const EMPTY_FORM: TaxpayerInput = {
  fullname: "",
  ifuNpi: "",
  phone: "01",
  commune: "",
  arrondissement: "",
  quartier: "",
  typeBien: "NON_BATI",
  superficie: "",
  valeurLocative: "",
  startYear: 2023,
  // Champs FB
  isLoue: false,
  valeurIrf: "",
  description: "",
};

interface NewLiquidationFormProps {
  canApplyExoneration: boolean;
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

/** Lit le brouillon depuis le localStorage, retourne EMPTY_FORM si absent ou invalide */
function loadDraft(): TaxpayerInput {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return EMPTY_FORM;
    const parsed = JSON.parse(raw) as TaxpayerInput;
    // Validation minimale : le draft doit au moins avoir fullname ou commune
    if (typeof parsed !== "object" || (!parsed.fullname && !parsed.commune)) return EMPTY_FORM;
    return { ...EMPTY_FORM, ...parsed };
  } catch {
    return EMPTY_FORM;
  }
}

export default function NewLiquidationForm({ canApplyExoneration }: NewLiquidationFormProps) {
  const [formData, setFormData] = useState<TaxpayerInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const { toast, toasts } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restaurer le brouillon au montage
  useEffect(() => {
    const draft = loadDraft();
    const hasContent = draft.fullname || draft.commune || draft.ifuNpi;
    if (hasContent) {
      setFormData(draft);
      setHasDraft(true);
    }
  }, []);

  // Sauvegarde automatique avec debounce 800ms à chaque modification
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const hasContent = formData.fullname || formData.commune || formData.ifuNpi;
      if (hasContent) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
          setHasDraft(true);
        } catch {
          // Si le localStorage est plein on ignore silencieusement
        }
      }
    }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formData]);

  const handleReset = () => {
    setFormData(EMPTY_FORM);
    setHasDraft(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  };

  const effectiveFormData = useMemo<TaxpayerInput>(
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
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-slate-800 text-white border border-slate-700 px-4 py-2 rounded-xl text-xs font-mono w-fit">
          <FileCheck2 className="w-4 h-4 text-emerald-400" />
          <span>Format conforme DGI</span>
        </div>
        {hasDraft && (
          <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30 px-3 py-2 rounded-xl text-xs font-medium">
            <Save className="w-3.5 h-3.5 text-amber-500" />
            <span>Brouillon restauré (sauvegarde automatique)</span>
          </div>
        )}
      </div>
      <TaxForm
        formData={effectiveFormData}
        onChange={setFormData}
        onReset={handleReset}
        canApplyExoneration={canApplyExoneration}
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Nom</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-900">
              {effectiveFormData.fullname || "Non renseigne"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">NPI / IFU</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-900">
              {effectiveFormData.ifuNpi || "Non renseigne"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Total</p>
            <p className="mt-1 text-sm font-extrabold text-emerald-700">
              {formatMoney(calculations.totalDu)} FCFA
            </p>
          </div>
        </div>
      </div>
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