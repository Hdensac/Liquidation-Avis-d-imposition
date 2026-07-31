"use client";

import React, { useState } from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { generateExcelLiquidation } from "@/utils/excelGenerator";
import { generatePDFFromElement } from "@/utils/pdfGenerator";
import { FileText, FileSpreadsheet, Loader2, Printer } from "lucide-react";

interface ExportButtonsProps {
  formData: TaxpayerInput;
  calculations: LiquidationCalculations;
  previewElementId: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  formData,
  calculations,
  previewElementId,
}) => {
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

  const handleExportPDF = async () => {
    try {
      setLoadingPdf(true);
      const filename = `Liquidation_TFU_${
        formData.fullname ? formData.fullname.replace(/\s+/g, "_") : "Contribuable"
      }_${formData.startYear}.pdf`;
      await generatePDFFromElement(previewElementId, filename);
    } catch (error) {
      console.error("Erreur lors de la génération du PDF:", error);
      alert("Une erreur s'est produite lors de la génération du PDF.");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoadingExcel(true);
      await generateExcelLiquidation(formData, calculations);
    } catch (error) {
      console.error("Erreur lors de la génération d'Excel:", error);
      alert("Une erreur s'est produite lors de la génération du fichier Excel.");
    } finally {
      setLoadingExcel(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        Documents prêts à être générés
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Bouton Impression Directe */}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-medium text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <Printer className="w-4 h-4" />
          Imprimer
        </button>

        {/* Bouton Export Excel */}
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={loadingExcel}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-medium text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {loadingExcel ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Génération Excel...
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-4 h-4" />
              Télécharger Excel (.xlsx)
            </>
          )}
        </button>

        {/* Bouton Export PDF */}
        <button
          type="button"
          onClick={handleExportPDF}
          disabled={loadingPdf}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 font-medium text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {loadingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Génération PDF...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Télécharger PDF (A4)
            </>
          )}
        </button>
      </div>
    </div>
  );
};
