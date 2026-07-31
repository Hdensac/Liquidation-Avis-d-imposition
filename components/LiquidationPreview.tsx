"use client";

import React from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";

interface LiquidationPreviewProps {
  formData: TaxpayerInput;
  calculations: LiquidationCalculations;
  documentRef?: React.RefObject<HTMLDivElement>;
}

export const LiquidationPreview: React.FC<LiquidationPreviewProps> = ({
  formData,
  calculations,
  documentRef,
}) => {
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  };

  const currentDateStr = new Date().toLocaleDateString("fr-FR");

  return (
    <div className="flex justify-center w-full">
      <div
        ref={documentRef}
        id="liquidation-document"
        className="a4-document text-black text-xs space-y-6 relative select-none font-sans"
        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
      >
        {/* Date du jour en haut à droite */}
        <div className="flex justify-between items-start">
          <div className="text-left text-[11px] font-medium text-gray-600">
            {/* Espace libre à gauche si besoin */}
          </div>
          <div className="text-right text-xs font-semibold text-gray-800">
            Date : {currentDateStr}
          </div>
        </div>

        {/* Sous-titre officiel centré */}
        <div className="text-center font-semibold text-slate-700 italic text-sm -mt-2">
          Impôt Foncier Unique (TFU / FNB)
        </div>

        {/* Titre Principal : LIQUIDATION */}
        <div className="text-center my-3">
          <h1 className="text-xl font-extrabold uppercase tracking-widest">
            LIQUIDATION
          </h1>
        </div>

        {/* Section Infos Contribuable & Adresse conforme à la capture */}
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold items-center">
            <div className="col-span-5 flex items-center gap-1">
              <span className="font-extrabold uppercase">NOM & PRENOMS</span>
              <span>{formData.fullname || "________________________"}</span>
            </div>
            <div className="col-span-4 flex items-center gap-1">
              <span className="font-extrabold uppercase">N° IFU/NPI :</span>
              <span className="font-mono">{formData.ifuNpi || "________________"}</span>
            </div>
            <div className="col-span-3 flex items-center gap-1 justify-end">
              <span className="font-extrabold uppercase">Tél :</span>
              <span>{formData.phone || "____________"}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs font-semibold pt-1">
            <span className="font-extrabold uppercase whitespace-nowrap">ADRESSE :</span>
            <span className="uppercase font-bold tracking-tight">
              {calculations.adresseDescription}
            </span>
          </div>
        </div>

        {/* Ligne VA et SURF alignée */}
        <div className="flex justify-between items-center text-xs font-bold pt-4 pb-2">
          <div className="flex items-center gap-6">
            <span className="uppercase font-extrabold text-sm">VA</span>
            <span className="font-mono text-sm border-b border-gray-400 px-3">
              {calculations.valeurLocative > 0 ? formatMoney(calculations.valeurLocative) : ""}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="uppercase font-extrabold text-sm">SURF</span>
            <span className="font-mono text-sm underline font-extrabold">
              {calculations.surf > 0 ? calculations.surf : ""}
            </span>
          </div>
        </div>

        {/* Tableau des Exercices (Bordures noires nettes) */}
        <div className="w-full">
          <table className="w-full border-collapse border-2 border-black text-xs">
            <thead>
              <tr className="border-b-2 border-black text-center font-extrabold bg-white">
                <th className="border-r border-black p-2.5 w-20">Exercice</th>
                <th className="border-r border-black p-2.5 w-32 uppercase">NATURE D' IMPOTS</th>
                <th className="border-r border-black p-2.5">Description</th>
                <th className="border-r border-black p-2.5 w-28">Base</th>
                <th className="border-r border-black p-2.5 w-20">Taux</th>
                <th className="p-2.5 w-32">Droit simple</th>
              </tr>
            </thead>
            <tbody>
              {calculations.exercises.map((ex, idx) => (
                <tr key={ex.year} className="border-b border-black text-center">
                  <td className="border-r border-black p-2.5 font-bold font-mono text-sm">{ex.year}</td>
                  <td className="border-r border-black p-2.5 font-bold">{ex.taxNature}</td>
                  
                  {/* Fusion verticale de la description sur la 1ère ligne */}
                  {idx === 0 && (
                    <td
                      rowSpan={4}
                      className="border-r border-black p-3 text-center align-middle font-bold text-xs leading-relaxed bg-white uppercase"
                    >
                      {calculations.adresseDescription}
                    </td>
                  )}

                  <td className="border-r border-black p-2.5 text-right font-mono font-bold text-sm">
                    {formatMoney(ex.baseImposable)}
                  </td>
                  <td className="border-r border-black p-2.5 font-bold text-sm">
                    {(ex.taux * 100).toFixed(0)}%
                  </td>
                  <td className="p-2.5 text-right font-bold font-mono text-sm">
                    {formatMoney(ex.droitSimple)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bloc centralisé en bas pour le Total Dû (Cadre noir comme sur la capture) */}
        <div className="pt-8 flex justify-center items-center">
          <div className="border-2 border-black px-12 py-2 text-center bg-white shadow-sm">
            <span className="text-lg font-extrabold font-mono tracking-wider">
              {formatMoney(calculations.totalDu)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
