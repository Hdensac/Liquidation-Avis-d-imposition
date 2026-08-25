import jsPDF from "jspdf";
import { TaxpayerInput } from "@/types/liquidation";
import { buildLiquidationCalculations } from "@/utils/liquidationCalculations";

// --- Constantes mise en page A4 portrait ---
const PAGE_W = 210;
const MARGIN_X = 15;
const MARGIN_TOP = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN_X; // 180 mm

// --- Utilitaires ---

function fmt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function cellText(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { align?: "left" | "center" | "right" } = {}
) {
  const { align = "left" } = opts;
  const cx =
    align === "center" ? x + w / 2 : align === "right" ? x + w - 2 : x + 2;
  const cy = y + h / 2 + 1.5;
  pdf.text(text, cx, cy, { align });
}

// --- Generateur principal ---

/**
 * Genere et telecharge le PDF de liquidation (FNB ou FB).
 * Rendu vectoriel jsPDF pur - deterministique quel que soit le navigateur.
 * Pas d'html2canvas, pas de DOM cache, pas de canvas memoire.
 */
export function generateLiquidationPdf(
  formData: TaxpayerInput,
  filename: string
): void {
  const calc = buildLiquidationCalculations(formData);
  const isBati = formData.typeBien === "BATI";
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = MARGIN_TOP;

  // 1. Date
  const dateStr = new Date().toLocaleDateString("fr-FR");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(`Date : ${dateStr}`, PAGE_W - MARGIN_X, y, { align: "right" });
  y += 7;

  // 2. Sous-titre
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.text("Impot Foncier Unique (TFU)", PAGE_W / 2, y, { align: "center" });
  y += 7;

  // 3. Titre principal
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("LIQUIDATION", PAGE_W / 2, y, { align: "center" });
  y += 8;

  // 4. Ligne de separation
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.6);
  pdf.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 6;

  // 5. Infos contribuable
  pdf.setFontSize(8.5);

  const nom = (formData.fullname || "_______________________").toUpperCase();
  const ifu = formData.ifuNpi || "________________";
  const tel =
    formData.phone && formData.phone !== "01" ? formData.phone : "____________";

  pdf.setFont("helvetica", "bold");
  pdf.text("NOM & PRENOMS", MARGIN_X, y);
  pdf.setFont("helvetica", "normal");
  const nomLines = pdf.splitTextToSize(nom, 62);
  pdf.text(nomLines, MARGIN_X + 34, y);

  pdf.setFont("helvetica", "bold");
  pdf.text("N IFU/NPI :", MARGIN_X + 102, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(ifu, MARGIN_X + 120, y);

  pdf.setFont("helvetica", "bold");
  pdf.text("Tel :", MARGIN_X + 155, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(tel, MARGIN_X + 163, y);

  y += Math.max(6, nomLines.length * 4.5) + 2;

  // Adresse
  pdf.setFont("helvetica", "bold");
  pdf.text("ADRESSE :", MARGIN_X, y);
  pdf.setFont("helvetica", "normal");
  const addr = calc.adresseDescription.toUpperCase();
  const addrLines = pdf.splitTextToSize(addr, CONTENT_W - 28);
  pdf.text(addrLines, MARGIN_X + 28, y);
  y += Math.max(6, addrLines.length * 4.5) + 5;

  // 6. Infos bien (VA/VL et surface)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  const vaLabel = isBati ? "VL" : "VA";
  pdf.text(vaLabel, MARGIN_X, y);
  if (calc.valeurLocative > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.text(fmt(calc.valeurLocative), MARGIN_X + 12, y);
  }
  if (!isBati && calc.surfaceTotale > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Surface totale", PAGE_W - MARGIN_X - 50, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(String(calc.surfaceTotale), PAGE_W - MARGIN_X, y, { align: "right" });
  }
  y += 10;

  // 7. Tableau des exercices
  // Colonnes : Exercice | Nature | Description (fusionnee) | Base | Taux | Droit simple
  const colW = [22, 30, 0, 26, 16, 22];
  colW[2] = CONTENT_W - colW[0] - colW[1] - colW[3] - colW[4] - colW[5];

  const rowH = 9;
  const headerH = 10;
  const tableX = MARGIN_X;
  const exercises = calc.exercises;
  const nRows = exercises.length;

  // Header
  pdf.setLineWidth(0.5);
  pdf.setDrawColor(0);
  pdf.rect(tableX, y, CONTENT_W, headerH);

  const headers = [
    "Exercice",
    "Nature d impots",
    "Description",
    "Base",
    "Taux",
    "Droit simple",
  ];
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);

  let cxH = tableX;
  headers.forEach((h, i) => {
    if (i > 0) {
      pdf.setLineWidth(0.3);
      pdf.line(cxH, y, cxH, y + headerH);
    }
    cellText(pdf, h, cxH, y, colW[i], headerH, { align: "center" });
    cxH += colW[i];
  });
  y += headerH;

  // Corps
  const tableBodyH = nRows * rowH;

  pdf.setLineWidth(0.5);
  pdf.rect(tableX, y, CONTENT_W, tableBodyH);

  // Separateurs verticaux (ne pas tracer dans la cellule Description - deja tracees)
  pdf.setLineWidth(0.3);
  const descX = tableX + colW[0] + colW[1];
  const descW = colW[2];

  // Col 0|1
  pdf.line(tableX + colW[0], y, tableX + colW[0], y + tableBodyH);
  // Col 1|2 (Description)
  pdf.line(descX, y, descX, y + tableBodyH);
  // Col 2|3 (Description|Base)
  pdf.line(descX + descW, y, descX + descW, y + tableBodyH);
  // Col 3|4
  pdf.line(descX + descW + colW[3], y, descX + descW + colW[3], y + tableBodyH);
  // Col 4|5
  pdf.line(
    descX + descW + colW[3] + colW[4],
    y,
    descX + descW + colW[3] + colW[4],
    y + tableBodyH
  );

  // Texte Description fusionné
  const descText =
    exercises.length > 0
      ? isBati
        ? exercises[exercises.length - 1].description
        : exercises[0].description
      : "";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  const descLines = pdf.splitTextToSize(descText.toUpperCase(), descW - 3);
  pdf.text(descLines, descX + descW / 2, y + tableBodyH / 2, {
    align: "center",
    baseline: "middle",
  });

  // Lignes de données
  exercises.forEach((ex, idx) => {
    const rowY = y + idx * rowH;

    if (idx > 0) {
      pdf.setLineWidth(0.2);
      pdf.line(tableX, rowY, descX, rowY);
      pdf.line(descX + descW, rowY, tableX + CONTENT_W, rowY);
    }

    // Exercice
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    cellText(pdf, String(ex.year), tableX, rowY, colW[0], rowH, { align: "center" });

    // Nature
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    cellText(pdf, ex.taxNature, tableX + colW[0], rowY, colW[1], rowH, { align: "center" });

    // Base
    const baseX = descX + descW;
    const baseW = colW[3];
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    if (ex.taxNature === "P-ORTB") {
      cellText(pdf, "-", baseX, rowY, baseW, rowH, { align: "center" });
    } else if (ex.baseImposable > 0) {
      cellText(pdf, fmt(ex.baseImposable), baseX, rowY, baseW, rowH, { align: "right" });
    }

    // Taux
    const tauxX = baseX + baseW;
    const tauxW = colW[4];
    if (ex.taxNature === "P-ORTB") {
      cellText(pdf, "-", tauxX, rowY, tauxW, rowH, { align: "center" });
    } else {
      cellText(
        pdf,
        `${(ex.taux * 100).toFixed(0)}%`,
        tauxX,
        rowY,
        tauxW,
        rowH,
        { align: "center" }
      );
    }

    // Droit simple
    const droitX = tauxX + tauxW;
    const droitW = colW[5];
    cellText(pdf, fmt(ex.droitSimple), droitX, rowY, droitW, rowH, { align: "right" });
  });

  y += tableBodyH + 14;

  // 8. Total
  const totalBoxW = 70;
  const totalBoxH = 13;
  const totalBoxX = (PAGE_W - totalBoxW) / 2;

  pdf.setLineWidth(1);
  pdf.setDrawColor(0);
  pdf.rect(totalBoxX, y, totalBoxW, totalBoxH);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(
    `${fmt(calc.totalDu)} FCFA`,
    PAGE_W / 2,
    y + totalBoxH / 2,
    { align: "center", baseline: "middle" }
  );

  pdf.save(filename);
}
