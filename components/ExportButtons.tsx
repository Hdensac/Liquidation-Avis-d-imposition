"use client";

import React, { useState } from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { generateExcelLiquidation } from "@/utils/excelGenerator";
import { generatePDFFromElement } from "@/utils/pdfGenerator";

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

  // Retourne null pour masquer le composant proprement vis-à-vis de TypeScript
  return null;
};