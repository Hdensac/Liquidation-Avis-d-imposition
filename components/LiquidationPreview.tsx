"use client";

import React, { useMemo } from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { formatDescriptionBien, formatExonerationMention } from "@/utils/descriptionBien";
import { getTaxRuleForYear } from "@/utils/taxRules";

interface LiquidationPreviewProps {
  formData: TaxpayerInput;
  calculations: LiquidationCalculations;
  documentRef?: React.RefObject<HTMLDivElement>;
  documentId?: string;
}

function buildPreviewCalculations(formData: TaxpayerInput) {
  const surfaceTotale = typeof formData.superficie === "number" ? formData.superficie : 0;
  const surfaceImposable =
    typeof formData.superficieImposable === "number" && formData.superficieImposable > 0
      ? formData.superficieImposable
      : surfaceTotale;
  const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;

  const adresseDescription = formatDescriptionBien({
    superficie: surfaceTotale,
    commune: formData.commune,
    arrondissement: formData.arrondissement,
    quartier: formData.quartier,
  });

  const exonerationMention = formatExonerationMention({
    superficie: surfaceTotale,
    superficieImposable: surfaceImposable !== surfaceTotale ? surfaceImposable : null,
  });

  const description = exonerationMention
    ? `${adresseDescription}\n${exonerationMention}`
    : adresseDescription;

  const baseImposable = surfaceImposable * valeurLocative;
  const startYear =
    typeof formData.startYear === "number" && formData.startYear > 1900
      ? formData.startYear
      : 2023;

  const exercises = Array.from({ length: 4 }, (_, index) => {
    const year = startYear + index;
    const taxRule = getTaxRuleForYear(year, formData.typeBien);
    const droitSimple = baseImposable * taxRule.taux;

    return {
      year,
      taxNature: taxRule.natureImpot,
      description,
      baseImposable,
      taux: taxRule.taux,
      droitSimple,
    };
  });

  const totalDu = exercises.reduce((sum, ex) => sum + ex.droitSimple, 0);

  return {
    surfaceTotale,
    surfaceImposable,
    valeurLocative,
    adresseDescription,
    exonerationMention,
    description,
    exercises,
    totalDu,
  };
}

export const LiquidationPreview: React.FC<LiquidationPreviewProps> = ({
  formData,
  calculations,
  documentRef,
  documentId = "liquidation-document",
}) => {
  void calculations;

  const preview = useMemo(() => buildPreviewCalculations(formData), [formData]);

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
          <div className="text-right text-xs font-semibold text-gray-800">Date : {currentDateStr}</div>
        </div>

        <div className="text-center font-semibold text-slate-700 italic text-sm -mt-2">
          Impot Foncier Unique (TFU)
        </div>

        <div className="text-center my-3">
          <h1 className="text-xl font-extrabold uppercase tracking-widest">LIQUIDATION</h1>
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
            <span className="uppercase font-bold tracking-tight">{preview.adresseDescription}</span>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs font-bold pt-4 pb-2">
          <div className="flex items-center gap-6">
            <span className="uppercase font-extrabold text-sm">VA</span>
            <span className="font-mono text-sm font-extrabold text-green-700 px-1">
              {preview.valeurLocative > 0 ? formatMoney(preview.valeurLocative) : ""}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-6">
              <span className="uppercase font-extrabold text-sm">Surface totale</span>
              <span className="font-mono text-sm font-extrabold text-green-700 px-1">
                {preview.surfaceTotale > 0 ? preview.surfaceTotale : ""}
              </span>
            </div>
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
              {preview.exercises.map((ex, idx) => (
                <tr key={ex.year} className="text-center">
                  <td className="border-r border-b border-black p-2.5 font-bold font-mono text-sm">
                    {ex.year}
                  </td>
                  <td className="border-r border-b border-black p-2.5 font-bold">{ex.taxNature}</td>
                  {idx === 0 && (
                    <td
                      rowSpan={4}
                      className="border-r border-b border-black p-3 text-center align-middle font-bold text-xs leading-relaxed bg-white uppercase whitespace-pre-line"
                    >
                      <span>{preview.description}</span>
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
              {formatMoney(preview.totalDu)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

