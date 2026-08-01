import jsPDF from "jspdf";

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
    valeur_locative: number;
    start_year: number;
    status: string;
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Format numbers for display; by default show '-' for zero/invalid unless showZero=true.
function formatNumber(value: number, showZero = false) {
  if (!Number.isFinite(value)) return "-";
  if (!showZero && value === 0) return "-";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(value));
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
  return toNumber(details.liquidation.superficie) * toNumber(details.liquidation.valeur_locative);
}

function sanitizeText(s: unknown) {
  return String(s || "").replace(/&+/g, " ").replace(/[\u0000-\u001f]/g, " ").trim();
}

function buildRows(details: AvisRecouvrementDetails): AvisTableRow[] {
  const baseImposable = getBaseImposable(details);
  const rows = details.articles || [];

  return rows.map((article, index) => {
    const taux = isNumber(article.taux) ? article.taux : index === 0 ? 0.04 : 0.05;
    const droitSimple = baseImposable * taux;
    const penalite = toNumber(article.penalite, 0);
    const acomptePaye = toNumber(article.acompte_paye, 0);
    const resteDu = droitSimple + penalite - acomptePaye;

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
        ]
          .filter(Boolean)
          .join("/"),
      description:
        sanitizeText(article.description) ||
        `PARCELLE DE ${toNumber(details.liquidation.superficie)} M² ${[
          normalizeCommune(details.contribuable.commune),
          normalizeCommune(details.contribuable.arrondissement),
          normalizeCommune(details.contribuable.quartier),
        ]
          .filter(Boolean)
          .join("/")}`,
      base: baseImposable,
      taux,
      droit_simple: droitSimple,
      penalite,
      acompte_paye: acomptePaye,
      reste_du: resteDu,
    };
  });
}

function wrap(pdf: jsPDF, text: string, width: number) {
  return pdf.splitTextToSize(String(text || ""), width);
}

function drawStaticSidebar(pdf: jsPDF, commune: string) {
  const cx = SIDEBAR_X + SIDEBAR_W / 2;

  pdf.setFont("times", "normal");
  pdf.setFontSize(6.5);

  const headerLines = [
    "REPUBLIQUE DU BENIN",
    "----------------------",
    "MINISTERE DE L'ECONOMIE ET DES FINANCES",
    "----------------------",
    "DIRECTION GENERALE DES IMPOTS",
    "----------------------",
    "DIRECTION DEPARTEMENTALE DES IMPOTS DE L'ATLANTIQUE",
    "******",
    "CENTRE DES IMPOTS DES PETITES ENTREPRISES D'ALLADA",
    "----------------------",
    "SERVICE DE GESTION",
    "----------------------",
    "RECETTE DES IMPOTS D'ALLADA",
  ];

  let currentY = 10;
  headerLines.forEach((line) => {
    pdf.text(line, cx, currentY, { align: "center" });
    currentY += 3.2;
  });

  // Dates
  pdf.setFontSize(6.2);
  let dateY = 56;
  pdf.text("Date de notification : .……/……/20……", SIDEBAR_X + 1, dateY);
  pdf.text("Date de mise en rec.  : .……/……/20……", SIDEBAR_X + 1, dateY + 4.5);
  pdf.text("Date de majoration   : .……/……/20……", SIDEBAR_X + 1, dateY + 9);

  // Cadre "AVIS AUX CONTRIBUABLES"
  const boxY = 72;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(SIDEBAR_X + 1, boxY, SIDEBAR_W - 2, 70, 3, 3);

  pdf.setFont("times", "bold");
  pdf.setFontSize(8.5);
  pdf.text("AVIS AUX CONTRIBUABLES", cx, boxY + 6, { align: "center" });

  pdf.setFont("times", "normal");
  pdf.setFontSize(4.6);
  const avisText = [
    "Les demandes en décharge ou réduction doivent être adressées au Directeur Général des Impôts dans les trois mois qui suivent la notification du présent avis d'imposition.",
    "Les demandes en remise ou modération doivent être adressées au Directeur des Impôts dans le mois de l'événement qui les motive. Celles qui sont motivées par la gêne ou l'indigence pe[...]",
    "Tout renseignement sur la nature des impôts faisant l'objet de cet avis d'imposition peut être demandé au Service d'Assiette.",
    "Le paiement des impôts se fait à la Caisse du Receveur des Impôts, soit en numéraire, soit par chèque bancaire certifié et libellé au nom du Receveur des Impôts.",
  ];

  let tY = boxY + 11;
  avisText.forEach((paragraph) => {
    const lines = wrap(pdf, paragraph, SIDEBAR_W - 5);
    pdf.text(lines, SIDEBAR_X + 3, tY);
    tY += lines.length * 2.1 + 1.2;
  });

  // Abréviations
  pdf.setFontSize(4.4);
  const abbrev = [
    "Abréviations : FNB = Foncier Non Bâti | FB = Foncier Bâti",
    "VV = Valeur Vénale | VL = Valeur Locative | RN = Revenu Net",
    "PEO = Prélèvement pour Enlèvement des Ordures",
    "TFU : Taxe Foncière Unique",
    "IRPP/RF = Impôt sur le Revenu des Personnes Physiques (Revenu Foncier)",
    "PORTB = Prélèvement pour l'Office de Radiodiffusion et Télévision",
    "Mode de calcul :",
    "TFU/FNB = VV x taux | TFU/FB = VL x taux",
  ];

  let abY = 146;
  abbrev.forEach((line, idx) => {
    pdf.setFont("times", idx === 6 ? "bold" : "normal");
    pdf.text(line, SIDEBAR_X + 1, abY);
    abY += 2.8;
  });
}

function drawStaticHeader(pdf: jsPDF, commune: string, annee: number) {
  pdf.setFont("times", "bold");
  pdf.setFontSize(14);
  pdf.text(`COMMUNE : ${commune}`, MAIN_X + MAIN_W / 2, 14, { align: "center" });
  pdf.setFontSize(12);
  pdf.text("TAXE FONCIERE UNIQUE", MAIN_X + MAIN_W / 2, 20, { align: "center" });
  
  pdf.setFontSize(10);
  pdf.text(`Année : ${annee}`, MAIN_X + MAIN_W - 2, 25, { align: "right" });

  // Bannière encadrée
  pdf.setLineWidth(0.4);
  pdf.rect(MAIN_X + 30, 28, MAIN_W - 60, 7, "S");
  pdf.setFontSize(11);
  pdf.text("AVIS DE MISE EN RECOUVREMENT", MAIN_X + MAIN_W / 2, 32.8, { align: "center" });
}

function drawRecipientBlock(pdf: jsPDF, details: AvisRecouvrementDetails) {
  const commune = normalizeCommune(details.role.commune);
  const roleLabel = `Role N°${details.role.numero_role}/${commune}/ ${details.role.annee}`;
  const addressParts = [
    normalizeCommune(details.contribuable.commune),
    normalizeCommune(details.contribuable.arrondissement),
    normalizeCommune(details.contribuable.quartier),
  ].filter(Boolean);
  const address = `PARCELLE DE ${toNumber(details.liquidation.superficie)} M² ${addressParts.join("/")}`;

  pdf.setFont("times", "bold");
  pdf.setFontSize(9);
  pdf.text("DESTINATAIRE :", MAIN_X, 43);
  pdf.text("N° IFU/NPI :", MAIN_X, 49);
  pdf.text("ADRESSE :", MAIN_X, 55);

  pdf.setFont("times", "normal");
  pdf.text(details.contribuable.nom_prenoms, MAIN_X + 30, 43);
  pdf.text(details.contribuable.ifu_npi, MAIN_X + 30, 49);
  pdf.text(`Tél : ${details.contribuable.telephone || "-"}`, MAIN_X + 150, 49);
  pdf.text(wrap(pdf, address, 140), MAIN_X + 30, 55);

  pdf.setFont("times", "bold");
  pdf.text(roleLabel, MAIN_X + 30, 62);
}

function drawArticlesTable(pdf: jsPDF, rows: AvisTableRow[]) {
  const startY = 68;
  const widths = [15, 14, 26, 38, 42, 18, 12, 18, 15, 18, 22];
  const headers = [
    ["N° des", "articles"],
    ["Exercice"],
    ["NATURE D' IMPOTS"],
    ["Localisation"],
    ["Description"],
    ["Base"],
    ["Taux"],
    ["Droit simple"],
    ["Pénalité"],
    ["Acompte", "payé"],
    ["Reste dû"],
  ];

  let x = MAIN_X;
  pdf.setDrawColor(0);
  pdf.setFillColor(210, 210, 210); // Gris entête officiel

  headers.forEach((headerLines, index) => {
    pdf.rect(x, startY, widths[index], 14, "FD");
    pdf.setFont("times", "bold");
    pdf.setFontSize(7.5);
    
    if (headerLines.length === 1) {
      pdf.text(headerLines[0], x + widths[index] / 2, startY + 8.5, { align: "center" });
    } else {
      pdf.text(headerLines[0], x + widths[index] / 2, startY + 5.5, { align: "center" });
      pdf.text(headerLines[1], x + widths[index] / 2, startY + 9.5, { align: "center" });
    }
    x += widths[index];
  });

  let y = startY + 14;

  // Ensure text color
  pdf.setTextColor(0, 0, 0);

  rows.forEach((row) => {
    const values = [
      String(row.numero_article),
      String(row.exercice),
      sanitizeText(row.nature_impot),
      sanitizeText(row.localisation),
      sanitizeText(row.description),
      // Base: always formatted number (show 0 as 0)
      formatNumber(row.base, true),
      `${Math.round(row.taux * 100)}%`,
      formatNumber(row.droit_simple),
      formatNumber(row.penalite),
      formatNumber(row.acompte_paye),
      formatNumber(row.reste_du),
    ];

    const wrapped = values.map((val, idx) => wrap(pdf, val, widths[idx] - 2));
    const rowHeight = Math.max(10, ...wrapped.map((lines) => lines.length * 3.2 + 3));
    let currentX = MAIN_X;

    values.forEach((_, idx) => {
      pdf.rect(currentX, y, widths[idx], rowHeight);
      pdf.setFont("times", idx <= 1 ? "bold" : "normal");
      pdf.setFontSize(7.5);

      const isCentered = idx <= 2 || idx === 6;
      const isRightAligned = idx === 5 || idx >= 7;

      let textX = currentX + 1.5;
      if (isCentered) textX = currentX + widths[idx] / 2;
      if (isRightAligned) textX = currentX + widths[idx] - 1.5;

      const align = isCentered ? "center" : isRightAligned ? "right" : "left";
      pdf.text(wrapped[idx], textX, y + 5.5, { align });

      currentX += widths[idx];
    });

    y += rowHeight;
  });

  return y;
}

function drawFooter(pdf: jsPDF, details: AvisRecouvrementDetails, endY: number, totalDu: number, dateEmission: Date) {
  const blockY = endY + 2;
  const totalWidth = MAIN_W;

  // Ligne TOTAL DÛ
  pdf.setFillColor(220, 220, 220);
  pdf.rect(MAIN_X, blockY, totalWidth, 8, "FD");
  pdf.setFont("times", "bold");
  pdf.setFontSize(12);
  pdf.text("TOTAL DÛ", MAIN_X + 60, blockY + 5.5, { align: "center" });
  pdf.text(formatNumber(totalDu, true), MAIN_X + totalWidth - 15, blockY + 5.5, { align: "right" });

  // Formule légale
  pdf.setFont("times", "bold");
  pdf.setFontSize(8.5);
  pdf.text(
    "Rendu exécutoire en vertu des dispositions des articles 596 et 597 du Code Général des Impôts,",
    MAIN_X + totalWidth / 2,
    blockY + 14,
    { align: "center" }
  );

  // Bloc de Signature
  const place = titleCase(normalizeCommune(details.role.commune));
  pdf.setFontSize(10);
  pdf.text(`${place}, le ${formatDateLong(dateEmission)}`, MAIN_X + totalWidth - 10, blockY + 26, { align: "right" });
  pdf.setFontSize(11);
  pdf.text("Le Chef du Service de Gestion", MAIN_X + totalWidth - 10, blockY + 33, { align: "right" });
  pdf.setFontSize(10);
  pdf.text("Hopeson HOUNSINOU", MAIN_X + totalWidth - 10, blockY + 48, { align: "right" });
}

export async function generateAvisRecouvrementPdf(details: AvisRecouvrementDetails, filename?: string) {
  const commune = normalizeCommune(details.role.commune) || normalizeCommune(details.contribuable.commune);
  const annee = toNumber(details.role.annee, new Date().getFullYear());
  const dateEmission = details.recouvrement.date_paiement ? new Date(details.recouvrement.date_paiement) : new Date();
  const rows = buildRows(details);
  const totalDu = rows.reduce((sum, row) => sum + row.reste_du, 0);

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  drawStaticSidebar(pdf, commune);
  drawStaticHeader(pdf, commune, annee);
  drawRecipientBlock(pdf, details);
  const endY = drawArticlesTable(pdf, rows);
  drawFooter(pdf, details, endY, totalDu, dateEmission);

  pdf.save(filename || `Avis_Recouvrement_${details.liquidation.reference_liq}.pdf`);
}
