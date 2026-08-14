"use client";

import React, { useMemo } from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";

interface LiquidationPreviewProps {
  formData: TaxpayerInput;
  calculations: LiquidationCalculations;
  documentRef?: React.RefObject<HTMLDivElement>;
  documentId?: string;
}

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

export const LiquidationPreview: React.FC<LiquidationPreviewProps> = ({
  formData,
  calculations,
  documentRef,
  documentId = "liquidation-document",
}) => {
  void calculations;

  const preview = useMemo(() => buildLiquidationCalculations(formData), [formData]);
  const isBati = formData.typeBien === "BATI";
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
          <div className="text-right text-xs font-semibold text-gray-800">Date : {currentDateStr}</div>
        </div>

        <div className="text-center font-semibold text-slate-700 italic text-sm -mt-2">
          Impot Foncier Unique (TFU)
        </div>

        <div className="text-center my-3">
          <h1 className="text-xl font-extrabold uppercase tracking-widest">LIQUIDATION</h1>
        </div>

        {/* Informations contribuable */}
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold items-center">
            <div className="col-span-5 flex items-center gap-1">
              <span className="font-extrabold uppercase">NOM &amp; PRENOMS</span>
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
            <span className="uppercase font-bold tracking-tight">{preview.adresseDescription}</span>
          </div>
        </div>

        {/* Informations du bien */}
        <div className="flex justify-between items-center text-xs font-bold pt-4 pb-2">
          <div className="flex items-center gap-6">
            {isBati ? (
              <>
                <span className="uppercase font-extrabold text-sm">VL</span>
                <span className="font-mono text-sm font-extrabold text-green-700 px-1">
                  {preview.valeurLocative > 0 ? formatMoney(preview.valeurLocative) : ""}
                </span>
              </>
            ) : (
              <>
                <span className="uppercase font-extrabold text-sm">VA</span>
                <span className="font-mono text-sm font-extrabold text-green-700 px-1">
                  {preview.valeurLocative > 0 ? formatMoney(preview.valeurLocative) : ""}
                </span>
              </>
            )}
          </div>
          {!isBati && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-6">
                <span className="uppercase font-extrabold text-sm">Surface totale</span>
                <span className="font-mono text-sm font-extrabold text-green-700 px-1">
                  {preview.surfaceTotale > 0 ? preview.surfaceTotale : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Tableau des exercices */}
        <div className="w-full">
          <table className="w-full border-collapse text-xs border-2 border-black bg-white">
            <thead>
              <tr className="text-center font-extrabold bg-white border-b-2 border-black">
                <th className="border-r border-black p-2.5 w-20">Exercice</th>
                <th className="border-r border-black p-2.5 w-32 uppercase">NATURE D&apos; IMPOTS</th>
                <th className="border-r border-black p-2.5">Description</th>
                <th className="border-r border-black p-2.5 w-28">Base</th>
                <th className="border-r border-black p-2.5 w-20">Taux</th>
                <th className="p-2.5 w-32">Droit simple</th>
              </tr>
            </thead>
            <tbody>
              {preview.exercises.map((ex, idx) => (
                <tr key={`${ex.year}-${ex.taxNature}-${idx}`} className="text-center">
                  <td className="border-r border-b border-black p-2.5 font-bold font-mono text-sm">
                    {ex.year}
                  </td>
                  <td className="border-r border-b border-black p-2.5 font-bold">{ex.taxNature}</td>
                  {/* Description : 1 cellule rowSpan pour FNB (4 lignes), cellule individuelle pour FB */}
                  {!isBati ? (
                    idx === 0 && (
                      <td
                        rowSpan={4}
                        className="border-r border-b border-black p-3 text-center align-middle font-bold text-xs leading-relaxed bg-white uppercase whitespace-pre-line"
                      >
                        <span>{ex.description}</span>
                      </td>
                    )
                  ) : (
                    <td className="border-r border-b border-black p-3 text-center align-middle font-bold text-xs leading-relaxed bg-white uppercase whitespace-pre-line">
                      <span>{ex.description}</span>
                    </td>
                  )}
                  <td className="border-r border-b border-black p-2.5 text-right font-mono font-bold text-sm">
                    {ex.baseImposable > 0 ? formatMoney(ex.baseImposable) : (ex.taxNature === "P-ORTB" ? "—" : "")}
                  </td>
                  <td className="border-r border-b border-black p-2.5 font-bold text-sm">
                    {ex.taxNature === "P-ORTB" ? "Forfait" : `${(ex.taux * 100).toFixed(0)}%`}
                  </td>
                  <td className="border-b border-black p-2.5 text-right font-bold font-mono text-sm">
                    {formatMoney(ex.droitSimple)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total dû */}
        <div className="pt-8 flex justify-center items-center">
          <div className="border-2 border-black px-12 py-2 text-center bg-white shadow-sm">
            <span className="text-lg font-extrabold font-mono tracking-wider">
              {formatMoney(preview.totalDu)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
