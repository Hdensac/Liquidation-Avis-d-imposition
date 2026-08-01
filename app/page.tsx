"use client";

import React, { useState, useMemo } from "react";
import { TaxpayerInput, LiquidationCalculations, TaxExercise } from "@/types/liquidation";
import { TaxForm } from "@/components/TaxForm";
import { LiquidationPreview } from "@/components/LiquidationPreview";
import { ExportButtons } from "@/components/ExportButtons";
import { FileCheck2, Sparkles } from "lucide-react";

const initialFormData: TaxpayerInput = {
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

export default function Home() {
  const [formData, setFormData] = useState<TaxpayerInput>(initialFormData);

  // Recalcul dynamique des données de liquidation
  const calculations: LiquidationCalculations = useMemo(() => {
    const surf = typeof formData.superficie === "number" ? formData.superficie : 0;
    const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;

    // Format Adresse & Description avec "SISE A" : PARCELLE DE [surf] M² SISE A [COMMUNE]/[ARRONDISSEMENT]/[QUARTIER]
    const communeStr = formData.commune ? formData.commune.toUpperCase() : "";
    const arrStr = formData.arrondissement ? formData.arrondissement.toUpperCase() : "";
    const quartStr = formData.quartier ? formData.quartier.toUpperCase() : "";
    
    const locationStr = [communeStr, arrStr, quartStr].filter(Boolean).join("/");
    const adresseDescription = locationStr
      ? `PARCELLE DE ${surf} M² SISE A ${locationStr}`
      : `PARCELLE DE ${surf} M²`;

    // Base imposable (par ligne) = SURF * VA
    const baseImposable = surf * valeurLocative;

    // Calcul des 4 exercices
    const exercises: TaxExercise[] = [];
    let totalDu = 0;

    const startYear = typeof formData.startYear === "number" && formData.startYear > 1900 ? formData.startYear : 2023;

    for (let i = 0; i < 4; i++) {
      const year = startYear + i;
      // Taux: 4% (0.04) pour la première année, 5% (0.05) pour les années 2, 3 et 4
      const taux = i === 0 ? 0.04 : 0.05;
      const droitSimple = baseImposable * taux;
      totalDu += droitSimple;

      exercises.push({
        year,
        taxNature: "TFU/FNB",
        description: adresseDescription,
        baseImposable,
        taux,
        droitSimple,
      });
    }

    return {
      surf,
      valeurLocative,
      adresseDescription,
      exercises,
      totalDu,
    };
  }, [formData]);

  const handleReset = () => {
    setFormData({
      fullname: "",
      ifuNpi: "",
      phone: "",
      commune: "",
      arrondissement: "",
      quartier: "",
      superficie: "",
      valeurLocative: 300,
      startYear: 2023,
    });
  };

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Banner Entête */}
        <header className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Générateur Automatisé d'Impôt Foncier (TFU / FNB)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Avis de Liquidation & Mise en Recouvrement
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Génération exacte au modèle administratif avec export PDF A4 & Excel dynamique.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-xs font-mono text-slate-300">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span>Format conforme DGI</span>
          </div>
        </header>

        {/* Formulaire de Saisie */}
        <section>
          <TaxForm
            formData={formData}
            onChange={setFormData}
            onReset={handleReset}
          />
        </section>

        {/* Barre d'Actions / Exportation */}
        <section className="no-print">
          <ExportButtons
            formData={formData}
            calculations={calculations}
            previewElementId="liquidation-document"
          />
        </section>

        {/* Aperçu Officiel A4 du Document */}
        <section className="space-y-4">
          <div className="flex items-center justify-between no-print px-2">
            <h2 className="text-lg font-bold text-slate-800">
              Aperçu en temps réel de la fiche officielle
            </h2>
            <span className="text-xs text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
              Format A4 Imprimable
            </span>
          </div>

          <div className="overflow-x-auto pb-8">
            <LiquidationPreview
              formData={formData}
              calculations={calculations}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
