import jsPDF from "jspdf";
import { TpsInput, buildTpsCalculations } from "@/utils/tpsCalculations";

// --- Constantes A4 portrait ---
const PAGE_W = 210;
const MARGIN_X = 14;
const CONTENT_W = PAGE_W - 2 * MARGIN_X;

// --- Utilitaires ---

function fmt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function drawTableRow(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  opts: { bold?: boolean; labelColW?: number } = {}
) {
  const { bold = false, labelColW = w * 0.75 } = opts;
  const valueColW = w - labelColW;
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, w, h);
  pdf.line(x + labelColW, y, x + labelColW, y + h);
  pdf.setFont("helvetica", bold ? "bold" : "normal");
  pdf.setFontSize(9);
  pdf.text(label, x + 2, y + h / 2 + 1.5);
  pdf.setFont("helvetica", bold ? "bold" : "normal");
  pdf.text(value, x + labelColW + valueColW - 2, y + h / 2 + 1.5, { align: "right" });
}

// --- Generateur principal TPS ---

/**
 * Genere et telecharge le PDF d'avis TPS.
 * Rendu vectoriel jsPDF pur - deterministique quel que soit le navigateur.
 * Pas d'html2canvas, pas de DOM cache.
 */
export function generateTpsPdf(
  formData: TpsInput,
  articleNumbers: string,
  roleNumber: string | number,
  dateStr: string,
  filename: string
): void {
  const calc = buildTpsCalculations({
    montantAutresActivites: formData.montantAutresActivites,
    acomptesPayes: formData.acomptesPayes,
    startYear: formData.startYear,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = 12;
  const assessmentYear = new Date().getFullYear();
  const commune = (formData.commune || "ALLADA").toUpperCase();
  const dateEmission = dateStr || new Date().toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  void roleNumber;

  // 1. En-tete : 3 colonnes
  const headerH = 36;
  const leftW = 72;
  const rightW = 72;
  const midW = CONTENT_W - leftW - rightW;

  // Colonne gauche : identite administrative
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  const adminLines = [
    "REPUBLIQUE DU BENIN",
    "MINISTERE DE L ECONOMIE ET DES FINANCES",
    "DIRECTION GENERALE DES IMPOTS",
    "CENTRE DES IMPOTS DES PETITES ENTREPRISES D ALLADA",
  ];
  let yl = y + 3;
  adminLines.forEach((line) => {
    const wl = pdf.splitTextToSize(line, leftW - 4);
    pdf.text(wl, MARGIN_X + leftW / 2, yl, { align: "center" });
    yl += wl.length * 3.5;
  });

  // Colonne milieu : logo (espace reserve)
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("[DGI]", MARGIN_X + leftW + midW / 2, y + headerH / 2, { align: "center" });

  // Colonne droite : titre de l'avis
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Avis de mise en recouvrement TPS", MARGIN_X + leftW + midW + rightW / 2, y + 10, { align: "center" });
  pdf.setFontSize(9);
  pdf.text(`ANNEE: ${assessmentYear}   EXERCICE: ${calc.startYear}`, MARGIN_X + leftW + midW + rightW / 2, y + 18, { align: "center" });
  pdf.text(`Commune de: ${commune}`, MARGIN_X + leftW + midW + rightW / 2, y + 25, { align: "center" });

  // Ligne separatrice sous en-tete
  pdf.setLineWidth(0.8);
  pdf.line(MARGIN_X, y + headerH, PAGE_W - MARGIN_X, y + headerH);
  y += headerH + 6;

  // 2. Section details : 2 colonnes
  const sectionH = 38;
  const leftColW = CONTENT_W / 2 - 3;
  const rightColW = CONTENT_W / 2 + 3;
  const rightColX = MARGIN_X + leftColW + 6;

  // Colonne gauche : dates et articles
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const dateFields = [
    "Date de mise en recouvrement : ...../...../.......",
    "Date de distribution : ...../...../.......",
    "Date de majoration : ...../...../.......",
    "Role : TPS",
  ];
  let yd = y + 2;
  dateFields.forEach((f) => {
    pdf.text(f, MARGIN_X, yd);
    yd += 5.5;
  });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(`ARTICLES : ${articleNumbers}`, MARGIN_X, y + sectionH - 4);

  // Colonne droite : identification contribuable
  pdf.setLineWidth(0.4);
  pdf.setFillColor(220, 220, 220);
  pdf.rect(rightColX, y, rightColW, sectionH, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Identification du contribuable", rightColX + rightColW / 2, y + 5, { align: "center" });
  pdf.setLineWidth(0.2);
  pdf.line(rightColX, y + 7, rightColX + rightColW, y + 7);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const contrib = [
    ["N IFU/NC:", formData.ifuNc || "A saisir"],
    ["Nom / Raison Sociale:", (formData.nomRaisonSociale || "A saisir").toUpperCase()],
    ["Adresse:", `${commune}/${(formData.arrondissement || "").toUpperCase()}/${(formData.quartier || "").toUpperCase()}`],
    ["Tel:", formData.telephone || "-"],
    ["Activite:", formData.activite || "A saisir"],
  ];
  let yc = y + 11;
  contrib.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, rightColX + 2, yc);
    pdf.setFont("helvetica", "normal");
    const vl = pdf.splitTextToSize(value, rightColW - 40);
    pdf.text(vl, rightColX + 40, yc);
    yc += 4.8;
  });

  y += sectionH + 6;

  // 3. Tableau des rubriques
  const tableW = CONTENT_W;
  const colLabelW = tableW * 0.75;
  const tRowH = 7.5;

  // Header tableau
  pdf.setFillColor(200, 200, 200);
  pdf.rect(MARGIN_X, y, tableW, tRowH, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Rubriques", MARGIN_X + 2, y + tRowH / 2 + 1.5);
  pdf.text("Montant", MARGIN_X + tableW - 2, y + tRowH / 2 + 1.5, { align: "right" });
  pdf.setLineWidth(0.4);
  pdf.line(MARGIN_X + colLabelW, y, MARGIN_X + colLabelW, y + tRowH);
  y += tRowH;

  const rows: Array<[string, string, boolean]> = [
    ["Chiffre d Affaires - Exportation de biens", "0", false],
    ["Chiffre d Affaires - Vente de biens", "0", false],
    ["Chiffre d Affaires - Exportation de services", "0", false],
    ["Chiffre d Affaires - Autres activites", fmt(formData.montantAutresActivites), false],
    ["Chiffre d Affaires - Transport", "0", false],
    ["Chiffre d Affaires - Total", fmt(formData.montantAutresActivites), true],
    ["TPS", fmt(calc.tpsCalcule), true],
    ["PORTB", fmt(calc.portb), false],
    ["Penalites", "0", false],
    ["Amendes", "0", false],
    ["PEO", "0", false],
    ["Impot du", fmt(calc.impotDu), true],
    ["Acomptes payes", fmt(formData.acomptesPayes), false],
    ["Reste du", fmt(calc.resteDu), true],
  ];

  rows.forEach(([label, value, bold]) => {
    drawTableRow(pdf, MARGIN_X, y, tableW, tRowH, label, value, { bold, labelColW: colLabelW });
    y += tRowH;
  });

  y += 6;

  // 4. Avis aux contribuables
  pdf.setLineWidth(0.4);
  pdf.rect(MARGIN_X, y, tableW, 22);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("AVIS AUX CONTRIBUABLES", MARGIN_X + 2, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  const avisText =
    "Les demandes en decharge ou reduction doivent etre adressees au Directeur General des Impots dans les trois mois qui suivent la date de mise en recouvrement. Le paiement des impots se fait a la caisse du receveur des impots, soit en numeraires, soit par cheque bancaire barre ou certifie a l ordre du Receveur des impots.";
  const avisLines = pdf.splitTextToSize(avisText, tableW - 4);
  pdf.text(avisLines, MARGIN_X + 2, y + 9);
  y += 26;

  // 5. Mention legale
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text(
    "Le present avis de mise en recouvrement est rendu executoire en vertu des dispositions des articles 596 et 597 du Code general des impots.",
    PAGE_W / 2,
    y,
    { align: "center", maxWidth: tableW }
  );
  y += 10;

  // 6. Footer : date et signature
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(`${commune} , le ${dateEmission}`, PAGE_W - MARGIN_X, y, { align: "right" });
  y += 5;
  pdf.text("Le Chef du Service de Gestion", PAGE_W - MARGIN_X, y, { align: "right" });
  y += 14;
  pdf.text("HOPESON HOUNSINOU", PAGE_W - MARGIN_X, y, { align: "right" });

  pdf.save(filename);
}
