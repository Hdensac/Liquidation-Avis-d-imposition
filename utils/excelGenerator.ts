import ExcelJS from "exceljs";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";

export const generateExcelLiquidation = async (
  formData: TaxpayerInput,
  calculations: LiquidationCalculations
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Système de Liquidation d'Impôt Foncier";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Liquidation TFU-FNB", {
    pageSetup: { paperSize: 9, orientation: "portrait" }, // A4
  });

  // Largeurs des colonnes (A à F)
  worksheet.columns = [
    { key: "exercice", width: 14 },        // Col A : Exercice
    { key: "nature", width: 20 },          // Col B : NATURE D' IMPOTS
    { key: "description", width: 45 },     // Col C : Description
    { key: "base", width: 20 },            // Col D : Base
    { key: "taux", width: 12 },            // Col E : Taux
    { key: "droitSimple", width: 22 },     // Col F : Droit simple
  ];

  // 1. Date du jour en haut à droite (F1)
  const currentDateStr = new Date().toLocaleDateString("fr-FR");
  worksheet.getCell("F1").value = `Date : ${currentDateStr}`;
  worksheet.getCell("F1").font = { name: "Calibri", size: 10, bold: true };
  worksheet.getCell("F1").alignment = { horizontal: "right" };

  // 2. Sous-titre officiel centré (A2:F2)
  worksheet.mergeCells("A2:F2");
  const subTitleCell = worksheet.getCell("A2");
  subTitleCell.value = "Impôt Foncier Unique (TFU / FNB)";
  subTitleCell.font = { name: "Calibri", size: 11, italic: true };
  subTitleCell.alignment = { horizontal: "center" };

  // 3. Titre Principal : LIQUIDATION (A4:F4)
  worksheet.mergeCells("A4:F4");
  const titleCell = worksheet.getCell("A4");
  titleCell.value = "LIQUIDATION";
  titleCell.font = { name: "Calibri", size: 16, bold: true };
  titleCell.alignment = { horizontal: "center" };

  // 4. Infos Contribuable (Ligne 6 & 7)
  const row6 = 6;
  worksheet.getCell(`A${row6}`).value = "NOM & PRENOMS :";
  worksheet.getCell(`A${row6}`).font = { bold: true };
  worksheet.getCell(`B${row6}`).value = formData.fullname || "";
  worksheet.getCell(`B${row6}`).font = { bold: true };

  worksheet.getCell(`C${row6}`).value = "N° IFU/NPI :";
  worksheet.getCell(`C${row6}`).font = { bold: true };
  worksheet.getCell(`D${row6}`).value = formData.ifuNpi || "";
  worksheet.getCell(`D${row6}`).font = { bold: true };

  worksheet.getCell(`E${row6}`).value = "Tél :";
  worksheet.getCell(`E${row6}`).font = { bold: true };
  worksheet.getCell(`F${row6}`).value = formData.phone || "";
  worksheet.getCell(`F${row6}`).font = { bold: true };

  // Ligne Adresse (Ligne 7)
  const row7 = 7;
  worksheet.getCell(`A${row7}`).value = "ADRESSE :";
  worksheet.getCell(`A${row7}`).font = { bold: true };
  worksheet.mergeCells(`B${row7}:F${row7}`);
  worksheet.getCell(`B${row7}`).value = calculations.adresseDescription;
  worksheet.getCell(`B${row7}`).font = { bold: true };

  // Ligne VA & SURFACE (Ligne 9) - Nombres en vert sans soulignement
  const row9 = 9;
  worksheet.getCell(`A${row9}`).value = "VA";
  worksheet.getCell(`A${row9}`).font = { bold: true, size: 12 };
  worksheet.getCell(`B${row9}`).value = calculations.valeurLocative;
  worksheet.getCell(`B${row9}`).font = { bold: true, size: 12, color: { argb: "FF15803D" } }; // Vert
  worksheet.getCell(`B${row9}`).numFmt = "#,##0";

  worksheet.getCell(`E${row9}`).value = "SURFACE";
  worksheet.getCell(`E${row9}`).font = { bold: true, size: 12 };
  worksheet.getCell(`E${row9}`).alignment = { horizontal: "right" };
  worksheet.getCell(`F${row9}`).value = calculations.surf;
  worksheet.getCell(`F${row9}`).font = { bold: true, size: 12, color: { argb: "FF15803D" } }; // Vert
  worksheet.getCell(`F${row9}`).alignment = { horizontal: "right" };

  // 5. En-tête du Tableau (Ligne 11)
  const headerRowIndex = 11;
  const headers = [
    "Exercice",
    "NATURE D' IMPOTS",
    "Description",
    "Base",
    "Taux",
    "Droit simple",
  ];
  
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = headers;
  headerRow.font = { name: "Calibri", size: 11, bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  
  ["A", "B", "C", "D", "E", "F"].forEach((col) => {
    const cell = worksheet.getCell(`${col}${headerRowIndex}`);
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  });

  // 6. Lignes des 4 Exercices (Lignes 12 à 15)
  const startTableDataRow = 12;
  calculations.exercises.forEach((ex, index) => {
    const currentRow = startTableDataRow + index;
    const row = worksheet.getRow(currentRow);
    
    // Formule Excel dynamique pour la base imposable: SURF * VA (F9 * B9)
    const baseFormula = `=F9*B9`;
    // Formule Excel dynamique pour le droit simple: Base * Taux
    const droitFormula = `=D${currentRow}*E${currentRow}`;

    row.getCell(1).value = ex.year;
    row.getCell(2).value = ex.taxNature;
    // Col 3 fusionnée plus bas
    row.getCell(4).value = { formula: baseFormula, result: ex.baseImposable };
    row.getCell(5).value = ex.taux;
    row.getCell(6).value = { formula: droitFormula, result: ex.droitSimple };

    // Alignment et formatage
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(4).numFmt = "#,##0";
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(5).numFmt = "0%";
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).numFmt = "#,##0";
    row.getCell(6).alignment = { horizontal: "right" };

    // Style de bordures
    ["A", "B", "C", "D", "E", "F"].forEach((col) => {
      worksheet.getCell(`${col}${currentRow}`).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Fusionner verticalement la cellule Description pour les 4 lignes (C12:C15)
  const endTableDataRow = startTableDataRow + 3;
  worksheet.mergeCells(`C${startTableDataRow}:C${endTableDataRow}`);
  const descCell = worksheet.getCell(`C${startTableDataRow}`);
  descCell.value = calculations.adresseDescription;
  descCell.font = { bold: true };
  descCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  // 7. Total Général Dû avec Formule Excel =SOMME(F12:F15) (Centré et encadré en bas)
  const totalRowIndex = endTableDataRow + 2;
  worksheet.mergeCells(`C${totalRowIndex}:D${totalRowIndex}`);
  const totalCell = worksheet.getCell(`C${totalRowIndex}`);
  totalCell.value = {
    formula: `=SUM(F${startTableDataRow}:F${endTableDataRow})`,
    result: calculations.totalDu,
  };
  totalCell.font = { name: "Calibri", size: 14, bold: true };
  totalCell.numFmt = "#,##0";
  totalCell.alignment = { horizontal: "center", vertical: "middle" };

  // Cadre noir autour de la case du Total
  ["C", "D"].forEach((col) => {
    const cell = worksheet.getCell(`${col}${totalRowIndex}`);
    cell.border = {
      top: { style: "medium" },
      left: col === "C" ? { style: "medium" } : { style: "thin" },
      bottom: { style: "medium" },
      right: col === "D" ? { style: "medium" } : { style: "thin" },
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
