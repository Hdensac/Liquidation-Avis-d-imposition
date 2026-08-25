"use client";

import React, { useState } from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { generateLiquidationPdf } from "@/utils/liquidationPdfGenerator";

interface ExportButtonsProps {
  formData: TaxpayerInput;
  calculations: LiquidationCalculations;
  previewElementId: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  formData,
  calculations: _calculations,
  previewElementId: _previewElementId,
}) => {
  const [loadingPdf, setLoadingPdf] = useState(false);

  const handleExportPDF = async () => {
    try {
      setLoadingPdf(true);
      const filename = `Liquidation_TFU_${
        formData.fullname ? formData.fullname.replace(/\s+/g, "_") : "Contribuable"
      }_${formData.startYear}.pdf`;
      // Rendu vectoriel pur jsPDF - deterministique, sans html2canvas
      generateLiquidationPdf(formData, filename);
    } catch (error) {
      console.error("Erreur lors de la generation du PDF:", error);
      alert("Une erreur s est produite lors de la generation du PDF.");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Retourne null - boutons deja integres ailleurs dans le formulaire
  void handleExportPDF;
  void handlePrint;
  void loadingPdf;
  return null;
};
