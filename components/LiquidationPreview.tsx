"use client";

import React from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";

interface LiquidationPreviewProps {
  formData: TaxpayerInput;
  calculations: LiquidationCalculations;
  documentRef?: React.RefObject<HTMLDivElement>;
  documentId?: string;
}

export const LiquidationPreview: React.FC<LiquidationPreviewProps> = ({
  formData,
  calculations,
  documentRef,
  documentId = "liquidation-document",
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
        id={documentId}
        className="a4-document text-black text-xs space-y-6 relative select-none font-sans"
        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
      >
        <div className="flex justify-between items-start">
          <div className="text-left text-[11px] font-medium text-gray-600"></div>
          <div className="text-right text-xs font-semibold text-gray-800">
            Date : {currentDateStr}
          </div>
        </div>

        <div className="text-center font-semibold text-slate-700 italic text-sm -mt-2">
          Impot Foncier Unique (TFU / FNB)
        </div>

        <div className="text-center my-3">
          <h1 className="text-xl font-extrabold uppercase tracking-widest">
            LIQUIDATION
          </h1>
        </div>

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
              <span className="font-extrabold uppercase">Tel :</span>
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

        <div className="flex justify-between items-center text-xs font-bold pt-4 pb-2">
          <div className="flex items-center gap-6">
            <span className="uppercase font-extrabold text-sm">VA</span>
            <span className="font-mono text-sm font-extrabold text-green-700 px-1">
              {calculations.valeurLocative > 0 ? formatMoney(calculations.valeurLocative) : ""}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-6">
              <span className="uppercase font-extrabold text-sm">Surface totale</span>
              <span className="font-mono text-sm font-extrabold text-green-700 px-1">
                {calculations.surfaceTotale > 0 ? calculations.surfaceTotale : ""}
              </span>
            </div>
            {calculations.surfaceImposable > 0 && calculations.surfaceImposable !== calculations.surfaceTotale && (
              <div className="flex items-center gap-6 text-amber-700">
                <span className="uppercase font-extrabold text-sm">Surface imposable</span>
                <span className="font-mono text-sm font-extrabold px-1">
                  {calculations.surfaceImposable}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full">
          <table className="w-full border-collapse text-xs border-2 border-black bg-white">
            <thead>
              <tr className="text-center font-extrabold bg-white border-b-2 border-black">
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
                <tr key={ex.year} className="text-center">
                  <td className="border-r border-b border-black p-2.5 font-bold font-mono text-sm">
                    {ex.year}
                  </td>
                  <td className="border-r border-b border-black p-2.5 font-bold">
                    {ex.taxNature}
                  </td>
                  {idx === 0 && (
                    <td
                      rowSpan={4}
                      className="border-r border-b border-black p-3 text-center align-middle font-bold text-xs leading-relaxed bg-white uppercase"
                    >
                      {calculations.adresseDescription}
                    </td>
                  )}
                  <td className="border-r border-b border-black p-2.5 text-right font-mono font-bold text-sm">
                    {formatMoney(ex.baseImposable)}
                  </td>
                  <td className="border-r border-b border-black p-2.5 font-bold text-sm">
                    {(ex.taux * 100).toFixed(0)}%
                  </td>
                  <td className="border-b border-black p-2.5 text-right font-bold font-mono text-sm">
                    {formatMoney(ex.droitSimple)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
