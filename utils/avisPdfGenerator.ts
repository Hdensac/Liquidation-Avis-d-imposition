import jsPDF from "jspdf";
import { formatDescriptionBien } from "@/utils/descriptionBien";

export type AvisRecouvrementArticle = {
  id: string;
  numero_article: number;
  exercice: number;
  nature_impot: string;
  localisation: string;
  description: string;
  base: number;
  taux: number;
  droit_simple: number;
  penalite: number;
  acompte_paye: number;
  reste_du: number;
};

export type AvisRecouvrementDetails = {
  recouvrement: {
    id: string;
    liquidation_id: string;
    role_id: string;
    contribuable_id: string;
    date_paiement?: string | null;
  };
  liquidation: {
    id: string;
    reference_liq: string;
    superficie: number;
    superficie_imposable?: number | null;
    valeur_locative: number;
    start_year: number;
    type_bien?: string | null;
    status: string;
    description?: string | null;
    created_at: string;
  };
  role: {
    id: string;
    numero_role: number;
    commune: string;
    annee: number;
    status: string;
  };
  contribuable: {
    id: string;
    nom_prenoms: string;
    ifu_npi: string;
    telephone?: string;
    commune?: string;
    arrondissement?: string;
    quartier?: string;
  };
  articles: AvisRecouvrementArticle[];
};

type AvisTableRow = {
  numero_article: number;
  exercice: number;
  nature_impot: string;
  localisation: string;
  description: string;
  base: number;
  taux: number;
  droit_simple: number;
  penalite: number;
  acompte_paye: number;
  reste_du: number;
};

const PAGE_WIDTH = 297;
const SIDEBAR_X = 6;
const SIDEBAR_W = 44;
const MAIN_X = 53;
const MAIN_RIGHT = 6;
const MAIN_W = PAGE_WIDTH - MAIN_X - MAIN_RIGHT;

function isNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number, showZero = false) {
  if (!Number.isFinite(value)) return "-";
  if (!showZero && value === 0) return "-";
  const rounded = Math.round(value);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDateLong(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCommune(value?: string) {
  return (value || "").trim().toUpperCase();
}

function getBaseImposable(details: AvisRecouvrementDetails) {
  const isBati = details.liquidation.type_bien === "BATI";
  if (isBati) return toNumber(details.liquidation.valeur_locative);
  return toNumber(details.liquidation.superficie) * toNumber(details.liquidation.valeur_locative);
}

function sanitizeText(s: unknown) {
  return String(s || "")
    .replace(/&+/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRows(details: AvisRecouvrementDetails): AvisTableRow[] {
  const baseImposable = getBaseImposable(details);
  const rows = details.articles || [];
  return rows.map((article, index) => {
    const base = details.liquidation.type_bien === "BATI" && (article.nature_impot === "TFU/FB" || !article.nature_impot || article.nature_impot.includes("FB")) 
      ? (baseImposable > 0 ? baseImposable : toNumber(article.base, baseImposable))
      : toNumber(article.base, baseImposable);
    const taux = toNumber(article.taux, 0);
    const droitSimple = toNumber(article.droit_simple, base * taux);
    const penalite = toNumber(article.penalite, 0);
    const acomptePaye = toNumber(article.acompte_paye, 0);
    const resteDu = toNumber(article.reste_du, Math.max(0, droitSimple + penalite - acomptePaye));
    return {
      numero_article: toNumber(article.numero_article, index + 1),
      exercice: toNumber(article.exercice, details.liquidation.start_year + index),
      nature_impot: article.nature_impot || "TFU/FNB",
      localisation:
        article.localisation ||
        [
          normalizeCommune(details.contribuable.commune),
          normalizeCommune(details.contribuable.arrondissement),
          normalizeCommune(details.contribuable.quartier),
        ].filter(Boolean).join("/"),
      description:
        sanitizeText(article.description) ||
        formatDescriptionBien({
          superficie: toNumber(details.liquidation.superficie),
          superficieImposable: details.liquidation.superficie_imposable ?? null,
          commune: details.contribuable.commune,
          arrondissement: details.contribuable.arrondissement,
          quartier: details.contribuable.quartier,
        }),
      base,
      taux,
      droit_simple: Math.round(droitSimple),
      penalite: Math.round(penalite),
      acompte_paye: Math.round(acomptePaye),
      reste_du: Math.round(resteDu),
    };
  });
}

function wrap(pdf: jsPDF, text: string, width: number) {
  return pdf.splitTextToSize(String(text || ""), width);
}

function drawStaticSidebar(pdf: jsPDF, commune: string) {
  const cx = SIDEBAR_X + SIDEBAR_W / 2;
  pdf.setFont("times", "bold");
  pdf.setFontSize(7);
  const headerLines = [
    "REPUBLIQUE DU BENIN", "----------------------",
    "MINISTERE DE L'ECONOMIE ET DES FINANCES", "----------------------",
    "DIRECTION GENERALE DES IMPOTS", "----------------------",
    "DIRECTION DEPARTEMENTALE DES IMPOTS DE L'ATLANTIQUE", "******",
    `CENTRE DES IMPOTS DES PETITES ENTREPRISES D'ALLADA`, "----------------------",
    "SERVICE DE GESTION", "----------------------",
    `RECETTE DES IMPOTS DE ${commune}`,
  ];
  let currentY = 10;
  headerLines.forEach((line) => {
    const wrapped = pdf.splitTextToSize(line, SIDEBAR_W - 4);
    wrapped.forEach((subLine: string) => { pdf.text(subLine, cx, currentY, { align: "center" }); currentY += 3.2; });
  });
  pdf.setFontSize(6.2);
  let dateY = 72;
  pdf.text("Date de notification : ......./......./ 20......", SIDEBAR_X + 1, dateY);
  pdf.text("Date de mise en rec.  : ......./......./ 20......", SIDEBAR_X + 1, dateY + 5.5);
  pdf.text("Date de majoration    : ......./......./ 20......", SIDEBAR_X + 1, dateY + 11);
  const boxY = 85;
  const boxH = 98;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(SIDEBAR_X + 1, boxY, SIDEBAR_W - 2, boxH, 3, 3);
  pdf.setFont("times", "bold");
  pdf.setFontSize(8.5);
  pdf.text("AVIS AUX CONTRIBUABLES", cx, boxY + 6, { align: "center" });
  pdf.setFont("times", "normal");
  pdf.setFontSize(5.8);
  const avisText = [
    "Les demandes en decharge ou reduction doivent etre adressees au Directeur General des Impots dans les trois mois qui suivent la notification du present avis d'imposition.",
    "Les demandes en remise ou moderation doivent etre adressees au Directeur des Impots dans le mois de l'evenement qui les motive. Celles qui sont motivees par la gene ou l'indigene peuvent etre presentees a toute epoque.",
    "Tout renseignement sur la nature des impots faisant l'objet de cet avis d'imposition peut etre demande au Service d'Assiette.",
    "Le paiement des impots se fait a la Caisse du Receveur des Impots, soit en numeraire, soit par cheque bancaire certifie et libelle au nom du Receveur des Impots.",
  ];
  let tY = boxY + 12;
  avisText.forEach((paragraph) => {
    const lines = wrap(pdf, paragraph, SIDEBAR_W - 5);
    pdf.text(lines, SIDEBAR_X + 3, tY);
    tY += lines.length * 2.6 + 1.2;
  });
  pdf.setLineWidth(0.1);
  pdf.line(SIDEBAR_X + 3, tY + 1, SIDEBAR_X + SIDEBAR_W - 3, tY + 1);
  pdf.setFontSize(5.2);
  const abbrev = [
    "Abreviations : FNB = Foncier Non Bati | FB = Foncier Bati",
    "VV = Valeur Venale | VL = Valeur Locative | RN = Revenu Net",
    "PEO = Prelevement pour Enlevement des Ordures",
    "TFU : Taxe Fonciere Unique",
  ];
  let abY = tY + 4.5;
  abbrev.forEach((line) => {
    pdf.setFont("times", "normal");
    const wrappedLines = wrap(pdf, line, SIDEBAR_W - 6);
    pdf.text(wrappedLines, SIDEBAR_X + 3, abY);
    abY += wrappedLines.length * 2.6;
  });
  pdf.line(SIDEBAR_X + 3, abY + 1, SIDEBAR_X + SIDEBAR_W - 3, abY + 1);
  let calcY = abY + 4.5;
  pdf.setFont("times", "bold");
  pdf.setFontSize(5.5);
  pdf.text("Mode de calcul des Impots :", SIDEBAR_X + 3, calcY);
  pdf.setFont("times", "normal");
  pdf.setFontSize(5.0);
  const calcLines = ["TFU/FNB = VV x Taux de la TFU/FNB", "TFU/FB = VL x Taux de la TFU/FB", "IRPP/RF = RN x Taux de l'IRPP/RF"];
  calcY += 2.8;
  calcLines.forEach((line) => { pdf.text(line, SIDEBAR_X + 3, calcY); calcY += 2.5; });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
  });
}

function drawStaticHeader(pdf: jsPDF, commune: string, annee: number, dgiLogo: HTMLImageElement | null) {
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text(`COMMUNE : ${commune}`, MAIN_X + MAIN_W / 2, 14, { align: "center" });
  pdf.setFontSize(13);
  pdf.text("TAXE FONCIERE UNIQUE", MAIN_X + MAIN_W / 2, 20, { align: "center" });
  if (dgiLogo) {
    const maxW = 24; const maxH = 18;
    const naturalW = dgiLogo.naturalWidth || dgiLogo.width || maxW;
    const naturalH = dgiLogo.naturalHeight || dgiLogo.height || maxH;
    const ratio = naturalW / naturalH;
    let drawW = maxW; let drawH = maxW / ratio;
    if (drawH > maxH) { drawH = maxH; drawW = maxH * ratio; }
    const boxRight = MAIN_X + MAIN_W;
    const boxX = boxRight - maxW + (maxW - drawW) / 2;
    const boxY = 4 + (maxH - drawH) / 2;
    pdf.addImage(dgiLogo, "PNG", boxX, boxY, drawW, drawH);
  }
  pdf.setFontSize(10);
  pdf.text(`Annee : ${annee}`, MAIN_X + MAIN_W - 2, 27, { align: "right" });
  pdf.setLineWidth(0.4);
  pdf.setDrawColor(0);
  pdf.rect(MAIN_X + 30, 28, MAIN_W - 60, 7, "S");
  pdf.setFontSize(11);
  pdf.text("AVIS DE MISE EN RECOUVREMENT", MAIN_X + MAIN_W / 2, 32.8, { align: "center" });
}

function drawRecipientBlock(pdf: jsPDF, details: AvisRecouvrementDetails) {
  const commune = normalizeCommune(details.role.commune);
  const roleLabel = `Role N${String.fromCharCode(176)}${details.role.numero_role}/${commune}/${details.role.annee}`;
  const isBati = details.liquidation.type_bien === "BATI";
  let address = "";
  if (isBati) {
    const locStr = [
      normalizeCommune(details.contribuable.commune),
      normalizeCommune(details.contribuable.arrondissement),
      normalizeCommune(details.contribuable.quartier),
    ].filter(Boolean).join("/");
    const descLibre = (details.liquidation.description || "").trim().toUpperCase();
    address = descLibre ? `${descLibre} SISE A ${locStr}` : `PROPRIETE SISE A ${locStr}`;
  } else {
    address = formatDescriptionBien({
      superficie: toNumber(details.liquidation.superficie),
      superficieImposable: details.liquidation.superficie_imposable ?? null,
      commune: details.contribuable.commune,
      arrondissement: details.contribuable.arrondissement,
      quartier: details.contribuable.quartier,
    });
  }
  pdf.setFont("times", "bold");
  pdf.setFontSize(9);
  pdf.text("DESTINATAIRE :", MAIN_X, 43);
  pdf.text("N° IFU/NPI :", MAIN_X, 49);
  pdf.text("ADRESSE :", MAIN_X, 55);
  pdf.text(details.contribuable.nom_prenoms, MAIN_X + 30, 43);
  pdf.text(details.contribuable.ifu_npi, MAIN_X + 30, 49);
  pdf.text(`Tel : ${details.contribuable.telephone || "-"}`, MAIN_X + 150, 49);
  pdf.text(wrap(pdf, address, 160), MAIN_X + 30, 55);
  pdf.text(roleLabel, MAIN_X + 30, 62);
}

function drawArticlesTable(pdf: jsPDF, details: AvisRecouvrementDetails, rows: AvisTableRow[]) {
  const startY = 68;
  const widths = [10, 13, 24, 32, 39, 22, 12, 25, 13, 15, 33];
  const headers = [
    ["N", "Article"], ["Exercice"], ["Nature", "d'Impot"], ["Localisation"],
    ["Description"], ["Base"], ["Taux"], ["Droit", "Simple"],
    ["Penalite"], ["Acompte", "Paye"], ["Reste", "Du"],
  ];
  let x = MAIN_X;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.3);
  headers.forEach((headerLines, index) => {
    const cellX = x; const cellW = widths[index];
    pdf.setFillColor(215, 215, 215); pdf.setTextColor(0, 0, 0);
    pdf.rect(cellX, startY, cellW, 16, "F");
    pdf.setDrawColor(0, 0, 0); pdf.rect(cellX, startY, cellW, 16, "S");
    pdf.setFont("times", "bold"); pdf.setFontSize(8.5);
    if (headerLines.length === 1) {
      pdf.text(headerLines[0], cellX + cellW / 2, startY + 9, { align: "center" });
    } else {
      pdf.text(headerLines[0], cellX + cellW / 2, startY + 6, { align: "center" });
      pdf.text(headerLines[1], cellX + cellW / 2, startY + 12, { align: "center" });
    }
    x += cellW;
  });
  pdf.setFillColor(255, 255, 255); pdf.setTextColor(0, 0, 0);
  let y = startY + 16;
  const startRowsY = y;
  const CELL_MAX_FONT = 10; const CELL_MIN_FONT = 7;
  function fitCellFontSize(text: string, width: number): number {
    let size = CELL_MAX_FONT;
    while (size > CELL_MIN_FONT) {
      pdf.setFont("times", "bold"); pdf.setFontSize(size);
      const lines = wrap(pdf, text, width);
      if (lines.length <= 1) break;
      size -= 0.5;
    }
    return size;
  }
  // Localisation: always merged
  const locCommune = normalizeCommune(details.contribuable.commune);
  const locArrondissement = normalizeCommune(details.contribuable.arrondissement);
  const locQuartier = normalizeCommune(details.contribuable.quartier);
  const rawLocLines = [locCommune, locArrondissement ? `/ ${locArrondissement}` : "", locQuartier ? `/ ${locQuartier}` : ""].filter(Boolean);
  const finalLocLines: string[] = []; const finalLocFontSizes: number[] = [];
  rawLocLines.forEach((line) => {
    const fontSize = fitCellFontSize(line, widths[3] - 4);
    pdf.setFont("times", "bold"); pdf.setFontSize(fontSize);
    wrap(pdf, line, widths[3] - 4).forEach((subLine: string) => { finalLocLines.push(subLine); finalLocFontSizes.push(fontSize); });
  });
  pdf.setFontSize(10);
  // Description: merged for FNB, per-row for FB
  const isBati = details.liquidation.type_bien === "BATI";
  const mergeDescription = !isBati;
  const sup = toNumber(details.liquidation.superficie, 0);
  const comm = titleCase(details.contribuable.commune || "");
  const arrt = titleCase(details.contribuable.arrondissement || "");
  const quart = titleCase(details.contribuable.quartier || "");
  const finalDescLines: string[] = []; const finalDescFontSizes: number[] = [];
  if (mergeDescription) {
    const rawDescLinesFnb = ["PARCELLE DE", `${sup}m2 sise a`, comm, arrt ? `/ ${arrt}` : "", quart ? `/ ${quart}` : ""].filter(Boolean);
    rawDescLinesFnb.forEach((line) => {
      const fontSize = fitCellFontSize(line, widths[4] - 4);
      pdf.setFont("times", "bold"); pdf.setFontSize(fontSize);
      wrap(pdf, line, widths[4] - 4).forEach((subLine: string) => { finalDescLines.push(subLine); finalDescFontSizes.push(fontSize); });
    });
    pdf.setFontSize(10);
  }
  // Row heights
  const rowHeights = rows.map((row) => {
    const checkCols: { val: string; colIdx: number }[] = [
      { val: String(row.numero_article), colIdx: 0 },
      { val: String(row.exercice), colIdx: 1 },
      { val: sanitizeText(row.nature_impot), colIdx: 2 },
      ...(mergeDescription ? [] : [{ val: sanitizeText(row.description), colIdx: 4 }]),
      { val: formatNumber(row.base, true), colIdx: 5 },
      { val: `${Math.round(row.taux * 100)}%`, colIdx: 6 },
      { val: formatNumber(row.droit_simple, true), colIdx: 7 },
      { val: formatNumber(row.penalite, true), colIdx: 8 },
      { val: formatNumber(row.acompte_paye, true), colIdx: 9 },
      { val: formatNumber(row.reste_du, true), colIdx: 10 },
    ];
    const maxLines = checkCols.map(({ val, colIdx }) => colIdx === 2 || colIdx === 4 ? wrap(pdf, val, widths[colIdx] - 2).length : 1);
    return Math.max(13, ...maxLines.map((n) => n * 3.6 + 2.5));
  });
  let totalTableHeight = rowHeights.reduce((acc, h) => acc + h, 0);
  const locNeeded = finalLocLines.length * 4.0 + 6;
  const descNeeded = mergeDescription ? finalDescLines.length * 4.0 + 6 : 0;
  const needed = Math.max(locNeeded, descNeeded);
  if (needed > totalTableHeight) {
    const factor = needed / totalTableHeight;
    for (let i = 0; i < rowHeights.length; i++) rowHeights[i] *= factor;
    totalTableHeight = needed;
  }
  // Draw rows
  rows.forEach((row, rowIndex) => {
    const h = rowHeights[rowIndex];
    const allCols = [
      { val: String(row.numero_article), skip: false },
      { val: String(row.exercice), skip: false },
      { val: sanitizeText(row.nature_impot), skip: false },
      { val: "", skip: true },
      { val: mergeDescription ? "" : sanitizeText(row.description), skip: mergeDescription },
      { val: formatNumber(row.base, true), skip: false },
      { val: row.nature_impot === "P-ORTB" ? "Forfait" : `${Math.round(row.taux * 100)}%`, skip: false },
      { val: formatNumber(row.droit_simple, true), skip: false },
      { val: formatNumber(row.penalite, true), skip: false },
      { val: formatNumber(row.acompte_paye, true), skip: false },
      { val: formatNumber(row.reste_du, true), skip: false },
    ];
    let currentX = MAIN_X;
    allCols.forEach(({ val, skip }, idx) => {
      if (skip) { currentX += widths[idx]; return; }
      pdf.rect(currentX, y, widths[idx], h);
      pdf.setFont("times", "bold");
      let fontSize = 10;
      if (idx === 4) fontSize = fitCellFontSize(val, widths[idx] - 2);
      pdf.setFontSize(fontSize);
      const wrapped = idx === 2 || idx === 4 ? wrap(pdf, val, widths[idx] - 2) : [val];
      const textX = currentX + widths[idx] / 2;
      const textH = wrapped.length * (fontSize * 0.4);
      const textY = y + (h - textH) / 2 + fontSize * 0.3;
      pdf.text(wrapped, textX, textY, { align: "center" });
      currentX += widths[idx];
    });
    y += h;
  });
  // Draw merged Localisation
  const locX = MAIN_X + widths[0] + widths[1] + widths[2];
  pdf.rect(locX, startRowsY, widths[3], totalTableHeight);
  const locTextH = finalLocLines.length * 4.0;
  const locStartY = startRowsY + (totalTableHeight - locTextH) / 2 + 3.0;
  finalLocLines.forEach((line, i) => {
    pdf.setFont("times", "bold"); pdf.setFontSize(finalLocFontSizes[i] || 10);
    pdf.text(line, locX + widths[3] / 2, locStartY + i * 4.0, { align: "center" });
  });
  pdf.setFontSize(10);
  // Draw merged Description (FNB only)
  if (mergeDescription) {
    const descX = locX + widths[3];
    pdf.rect(descX, startRowsY, widths[4], totalTableHeight);
    const descTextH = finalDescLines.length * 4.0;
    const descStartY = startRowsY + (totalTableHeight - descTextH) / 2 + 3.0;
    finalDescLines.forEach((line, i) => {
      pdf.setFont("times", "bold"); pdf.setFontSize(finalDescFontSizes[i] || 10);
      pdf.text(line, descX + widths[4] / 2, descStartY + i * 4.0, { align: "center" });
    });
    pdf.setFontSize(10);
  }
  return y;
}

function drawFooter(pdf: jsPDF, details: AvisRecouvrementDetails, endY: number, totalDu: number, dateEmission: Date) {
  const blockY = endY + 4;
  const totalWidth = MAIN_W;
  pdf.setFillColor(210, 210, 210);
  pdf.rect(MAIN_X, blockY, totalWidth, 12, "FD");
  pdf.setFont("times", "bold"); pdf.setFontSize(13);
  pdf.text("TOTAL DU", MAIN_X + 70, blockY + 8, { align: "center" });
  pdf.text(formatNumber(totalDu, true), MAIN_X + totalWidth - 15, blockY + 8, { align: "right" });
  pdf.setFont("times", "bold"); pdf.setFontSize(9);
  pdf.text(
    "Rendu executoire en vertu des dispositions des articles 596 et 597 du Code General des Impots,",
    MAIN_X + totalWidth / 2, blockY + 20, { align: "center" }
  );
  pdf.setFontSize(10); pdf.setFont("times", "bold");
  pdf.text(`ALLADA , le ${formatDateLong(dateEmission)}`, MAIN_X + totalWidth - 10, blockY + 31, { align: "right" });
  pdf.setFontSize(11);
  pdf.text("Le Chef du Service de Gestion", MAIN_X + totalWidth - 10, blockY + 38, { align: "right" });
  pdf.text("HOPESON HOUNSINOU", MAIN_X + totalWidth - 10, blockY + 62, { align: "right" });
}

export async function generateAvisRecouvrementPdf(details: AvisRecouvrementDetails, filename?: string) {
  const commune = normalizeCommune(details.role.commune) || normalizeCommune(details.contribuable.commune);
  const annee = toNumber(details.role.annee, new Date().getFullYear());
  const dateEmission = details.recouvrement.date_paiement ? new Date(details.recouvrement.date_paiement) : new Date();
  const rows = buildRows(details);
  const totalDu = rows.reduce((sum, row) => sum + row.reste_du, 0);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let dgiLogo: HTMLImageElement | null = null;
  try { dgiLogo = await loadImage("/dgi_lg.png"); } catch (err) { console.error("Erreur logo DGI :", err); }
  drawStaticSidebar(pdf, commune);
  drawStaticHeader(pdf, commune, annee, dgiLogo);
  drawRecipientBlock(pdf, details);
  const endY = drawArticlesTable(pdf, details, rows);
  drawFooter(pdf, details, endY, totalDu, dateEmission);
  pdf.save(filename || `Avis_Recouvrement_${details.liquidation.reference_liq}.pdf`);
}
