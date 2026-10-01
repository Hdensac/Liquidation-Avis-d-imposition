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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
}

// --- Generateur principal TPS ---

/**
 * Genere et telecharge le PDF d'avis TPS.
 * Rendu vectoriel jsPDF pur - deterministique quel que soit le navigateur.
 * Pas d'html2canvas, pas de DOM cache.
 */
export async function generateTpsPdf(
  formData: TpsInput,
  articleNumbers: string,
  roleNumber: string | number,
  dateStr: string,
  filename: string
): Promise<void> {
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

  // Charger les images (Logo DGI et QR Code)
  let dgiLogo: HTMLImageElement | null = null;
  let qrCodeImg: HTMLImageElement | null = null;
  try {
    [dgiLogo, qrCodeImg] = await Promise.all([
      loadImage("/dgi_lg.png").catch(() => null),
      loadImage("/qrcode.png").catch(() => null),
    ]);
  } catch (err) {
    console.error("Erreur chargement des images PDF TPS :", err);
  }

  if (dgiLogo) {
    const maxW = 22;
    const maxH = 22;
    const naturalW = dgiLogo.naturalWidth || dgiLogo.width || maxW;
    const naturalH = dgiLogo.naturalHeight || dgiLogo.height || maxH;
    const ratio = naturalW / naturalH;
    let drawW = maxW;
    let drawH = maxW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = maxH * ratio;
    }
    const boxX = MARGIN_X + leftW + (midW - drawW) / 2;
    const boxY = y + (headerH - drawH) / 2;
    pdf.addImage(dgiLogo, "PNG", boxX, boxY, drawW, drawH);
  } else {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("[DGI]", MARGIN_X + leftW + midW / 2, y + headerH / 2, { align: "center" });
  }

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
  const leftColW = CONTENT_W / 2 - 3;
  const rightColW = CONTENT_W / 2 + 3;
  const rightColX = MARGIN_X + leftColW + 6;

  // Calcul dynamique de la hauteur d'identification et de la position yc pour eviter tout chevauchement
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const valueColW = rightColW - 40;
  const lineSpacing = 3.8;

  const contribItems = [
    { label: "N IFU/NC:", value: formData.ifuNc || "A saisir" },
    { label: "Nom / Raison Sociale:", value: (formData.nomRaisonSociale || "A saisir").toUpperCase() },
    { label: "Adresse:", value: `${commune}/${(formData.arrondissement || "").toUpperCase()}/${(formData.quartier || "").toUpperCase()}` },
    { label: "Tel:", value: formData.telephone || "-" },
    { label: "Activite:", value: formData.activite || "A saisir" },
  ];

  let totalContentH = 10;
  const preparedContrib = contribItems.map((item) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const lines = pdf.splitTextToSize(item.value, valueColW);
    const lineCount = Math.max(1, lines.length);
    const fieldH = lineCount * lineSpacing + 0.8;
    totalContentH += fieldH;
    return { label: item.label, lines, lineCount };
  });

  const sectionH = Math.max(38, totalContentH + 2);

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

  let yc = y + 11;
  preparedContrib.forEach(({ label, lines, lineCount }) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(label, rightColX + 2, yc);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(lines, rightColX + 40, yc);

    yc += lineCount * lineSpacing + 0.8;
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
    ["Chiffre d'Affaires - Exportation de biens", "0", false],
    ["Chiffre d'Affaires - Vente de biens", "0", false],
    ["Chiffre d'Affaires - Exportation de services", "0", false],
    ["Chiffre d'Affaires - Autres activites", fmt(formData.montantAutresActivites), false],
    ["Chiffre d'Affaires - Transport", "0", false],
    ["Chiffre d'Affaires - Total", fmt(formData.montantAutresActivites), true],
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
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  const avisParagraphs = [
    "• Les demandes en décharge ou réduction doivent être adressées au Directeur Général des Impôts dans les trois mois qui suivent la date de mise en recouvrement inscrite sur l’avis. Les demandes en remise ou modération doivent être adressées au Directeur dans le mois de l’événement qui les motive. Celles qui sont motivées par la gêne ou l’indigence peuvent être présentées à toute époque.",
    "• Tout renseignement sur la nature des impôts faisant l’objet de cet avis d’imposition peut être demandé au service des impôts de la localité.",
    "• Le paiement des impôts se fait à la caisse du receveur des impôts, soit en numéraires, soit par chèque bancaire barré ou certifié à l’ordre du Receveur des impôts.",
  ];
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  const avisLines = avisParagraphs.map((paragraph) => pdf.splitTextToSize(paragraph, tableW - 8));
  const avisLineH = 3;
  const avisBoxH = 10 + avisLines.reduce((height, lines) => height + lines.length * avisLineH + 1, 0);
  pdf.rect(MARGIN_X, y, tableW, avisBoxH);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.text("AVIS AUX CONTRIBUABLES", MARGIN_X + 2, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  let avisY = y + 9;
  avisLines.forEach((lines) => {
    pdf.text(lines, MARGIN_X + 4, avisY);
    avisY += lines.length * avisLineH + 1;
  });
  y += avisBoxH + 4;

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

  // 6. Footer : QR Code a gauche, date et signature a droite
  if (qrCodeImg) {
    const qrSize = 22; // 22 x 22 mm
    pdf.addImage(qrCodeImg, "PNG", MARGIN_X, y - 2, qrSize, qrSize);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text(`${commune} , le ${dateEmission}`, PAGE_W - MARGIN_X, y, { align: "right" });
  y += 5;
  pdf.text("Le Chef du Service de Gestion", PAGE_W - MARGIN_X, y, { align: "right" });
  y += 14;
  pdf.text("HOPESON HOUNSINOU", PAGE_W - MARGIN_X, y, { align: "right" });

  pdf.save(filename);
}
