import ExcelJS from "exceljs";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";

export const generateExcelLiquidation = async (
  formData: TaxpayerInput,
  calculations: LiquidationCalculations
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Système de Liquidation d'Impôt Foncier";
  workbook.lastModifiedBy = "Système de Liquidation";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Liquidation TFU-FNB", {
    pageSetup: { paperSize: 9, orientation: "portrait" }, // A4
  });

  // Largeurs des colonnes (A à F)
  worksheet.columns = [
    { key: "year", width: 12 },          // Col A
    { key: "taxNature", width: 14 },     // Col B
    { key: "description", width: 45 },   // Col C
    { key: "base", width: 22 },          // Col D
    { key: "taux", width: 12 },          // Col E
    { key: "droitSimple", width: 25 },   // Col F
  ];

  // 1. Titre & En-tête
  worksheet.mergeCells("A1:F1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "RÉPUBLIQUE DU BÉNIN - DIRECTION GÉNÉRALE DES IMPÔTS";
  titleCell.font = { name: "Calibri", size: 11, bold: true };
  titleCell.alignment = { horizontal: "center" };

  worksheet.mergeCells("A2:F2");
  const subTitleCell = worksheet.getCell("A2");
  subTitleCell.value = "LIQUIDATION  (TFU)";
  subTitleCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1E3A8A" } };
  subTitleCell.alignment = { horizontal: "center" };

  worksheet.addRow([]); // Ligne vide (Ligne 3)

  // 2. Infos Contribuable
  const infoStartRow = 4;
  worksheet.getCell(`A${infoStartRow}`).value = "Nom & Prénoms :";
  worksheet.getCell(`A${infoStartRow}`).font = { bold: true };
  worksheet.mergeCells(`B${infoStartRow}:C${infoStartRow}`);
  worksheet.getCell(`B${infoStartRow}`).value = formData.fullname || "";

  worksheet.getCell(`D${infoStartRow}`).value = "N° IFU / NPI :";
  worksheet.getCell(`D${infoStartRow}`).font = { bold: true };
  worksheet.mergeCells(`E${infoStartRow}:F${infoStartRow}`);
  worksheet.getCell(`E${infoStartRow}`).value = formData.ifuNpi || "";

  const infoRow2 = 5;
  worksheet.getCell(`A${infoRow2}`).value = "Téléphone :";
  worksheet.getCell(`A${infoRow2}`).font = { bold: true };
  worksheet.mergeCells(`B${infoRow2}:C${infoRow2}`);
  worksheet.getCell(`B${infoRow2}`).value = formData.phone || "";

  worksheet.getCell(`D${infoRow2}`).value = "Adresse :";
  worksheet.getCell(`D${infoRow2}`).font = { bold: true };
  worksheet.mergeCells(`E${infoRow2}:F${infoRow2}`);
  worksheet.getCell(`E${infoRow2}`).value = `${formData.commune} / ${formData.arrondissement} / ${formData.quartier}`;

  const infoRow3 = 6;
  worksheet.getCell(`A${infoRow3}`).value = "Superficie (SURF) :";
  worksheet.getCell(`A${infoRow3}`).font = { bold: true };
  worksheet.getCell(`B${infoRow3}`).value = calculations.surf;
  worksheet.getCell(`B${infoRow3}`).numFmt = '#,##0" m²"';

  worksheet.getCell(`D${infoRow3}`).value = "Valeur Administrative (VA) :";
  worksheet.getCell(`D${infoRow3}`).font = { bold: true };
  worksheet.getCell(`E${infoRow3}`).value = calculations.valeurLocative;
  worksheet.getCell(`E${infoRow3}`).numFmt = '#,##0" FCFA"';

  worksheet.addRow([]); // Ligne vide (Ligne 7 font)

  // 3. En-tête du Tableau (Ligne 8)
  const headerRowIndex = 8;
  const headers = [
    "Année",
    "Nature",
    "Adresse & Description du Bien Imposable",
    "Base Imposable (FCFA)",
    "Taux",
    "Droit Simple (FCFA)",
  ];
  
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = headers;
  headerRow.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  
  // Style d'en-tête bleu foncé
  ["A", "B", "C", "D", "E", "F"].forEach((col) => {
    const cell = worksheet.getCell(`${col}${headerRowIndex}`);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // 4. Lignes des 4 Exercices (Lignes 9 à 12)
  const startTableDataRow = 9;
  calculations.exercises.forEach((ex, index) => {
    const currentRow = startTableDataRow + index;
    const row = worksheet.getRow(currentRow);
    
    // Formule Excel dynamique pour la base imposable: SURF * VA (B6 * E6)
    const baseFormula = `=B6*E6`;
    // Formule Excel dynamique pour le droit simple: Base * Taux
    const droitFormula = `=D${currentRow}*E${currentRow}`;

    row.getCell(1).value = ex.year;
    row.getCell(2).value = ex.taxNature;
    // La colonne 3 (Description) sera fusionnée ci-dessous
    row.getCell(4).value = { formula: baseFormula, result: ex.baseImposable };
    row.getCell(5).value = ex.taux;
    row.getCell(6).value = { formula: droitFormula, result: ex.droitSimple };

    // Formatage des nombres
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(4).numFmt = "#,##0";
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(5).numFmt = "0%";
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).numFmt = "#,##0";
    row.getCell(6).alignment = { horizontal: "right" };

    // Bordures
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      worksheet.getCell(`${col}${currentRow}`).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Fusionner verticalement la cellule Description pour les 4 lignes (C9:C12)
  const endTableDataRow = startTableDataRow + 3;
  worksheet.mergeCells(`C${startTableDataRow}:C${endTableDataRow}`);
  const descCell = worksheet.getCell(`C${startTableDataRow}`);
  descCell.value = calculations.adresseDescription;
  descCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };

  // 5. Total Général Dû avec Formule Excel =SOMME(F9:F12)
  const totalRowIndex = endTableDataRow + 1;
  worksheet.mergeCells(`A${totalRowIndex}:E${totalRowIndex}`);
  const totalLabelCell = worksheet.getCell(`A${totalRowIndex}`);
  totalLabelCell.value = "TOTAL GÉNÉRAL DÛ (FCFA) :";
  totalLabelCell.font = { bold: true, size: 11 };
  totalLabelCell.alignment = { horizontal: "right" };

  const totalValueCell = worksheet.getCell(`F${totalRowIndex}`);
  totalValueCell.value = {
    formula: `=SUM(F${startTableDataRow}:F${endTableDataRow})`,
    result: calculations.totalDu,
  };
  totalValueCell.font = { bold: true, size: 11, color: { argb: "FF1E3A8A" } };
  totalValueCell.numFmt = '#,##0" FCFA"';
  totalValueCell.alignment = { horizontal: "right" };

  // Bordures pour le total
  ["A", "B", "C", "D", "E", "F"].forEach((col) => {
    const cell = worksheet.getCell(`${col}${totalRowIndex}`);
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E7FF" },
    };
  });

  // Générer le buffer et déclencher le téléchargement
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const fileName = `Liquidation_TFU_${formData.fullname ? formData.fullname.replace(/\s+/g, "_") : "Contribuable"}_${formData.startYear}.xlsx`;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};
