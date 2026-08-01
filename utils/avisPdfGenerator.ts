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
const PAGE_HEIGHT = 210;
const SIDEBAR_X = 8;
const SIDEBAR_W = 43;
const MAIN_X = 56;
const MAIN_RIGHT = 8;
const MAIN_W = PAGE_WIDTH - MAIN_X - MAIN_RIGHT;

function isNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatDateLong(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatDateShort(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
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
        article.description ||
        `PARCELLE DE ${toNumber(details.liquidation.superficie)} M2 SISE A ${[normalizeCommune(details.contribuable.commune), normalizeCommune(details.contribuable.arrondissement), normalizeCommune(details.contribuable.quartier)]
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

function centerLines(pdf: jsPDF, lines: string[], x: number, y: number, width: number, size: number) {
  pdf.setFont("times", "normal");
  pdf.setFontSize(size);
  let currentY = y;
  lines.forEach((line) => {
    pdf.text(line, x + width / 2, currentY, { align: "center" });
    currentY += size * 0.42 + 2.2;
  });
  return currentY;
}

function drawStaticSidebar(pdf: jsPDF, commune: string, dateRecouvrement: Date) {
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.4);
  pdf.rect(SIDEBAR_X, 8, SIDEBAR_W, 194);

  const cx = SIDEBAR_X + SIDEBAR_W / 2;
  centerLines(
    pdf,
    [
      "REPUBLIQUE DU BENIN",
      "----------------------",
      "MINISTERE DE L'ECONOMIE ET DES FINANCES",
      "----------------------",
      "DIRECTION GENERALE DES IMPOTS",
      "----------------------",
      "DIRECTION DEPARTEMENTALE DES IMPOTS DE L'ATLANTIQUE",
      "******",
      "CENTRE DES IMPOTS DES PETITES ENTREPRISES",
      `D'${commune}`,
      "----------------------",
      "SERVICE DE GESTION",
      "----------------------",
      "RECETTE DES IMPOTS",
      `D'${commune}`,
    ],
    SIDEBAR_X + 1,
    14,
    SIDEBAR_W - 2,
    7.4
  );

  pdf.setFont("times", "normal");
  pdf.setFontSize(6.6);
  pdf.text("Date de notification", SIDEBAR_X + 1, 66);
  pdf.text(": ........../........../20......", SIDEBAR_X + 1, 71);
  pdf.text("Date de mise en recouvrement", SIDEBAR_X + 1, 77);
  pdf.text(`: ${formatDateShort(dateRecouvrement)}`, SIDEBAR_X + 1, 82);
  pdf.text("Date de majoration", SIDEBAR_X + 1, 88);
  pdf.text(`: ${formatDateShort(dateRecouvrement)}`, SIDEBAR_X + 1, 93);

  pdf.roundedRect(SIDEBAR_X - 1, 101, SIDEBAR_W + 2, 63, 4, 4);
  pdf.setFont("times", "bold");
  pdf.setFontSize(10);
  pdf.text("AVIS AUX", cx, 113, { align: "center" });
  pdf.text("CONTRIBUABLES", cx, 119, { align: "center" });
  pdf.setFont("times", "normal");
  pdf.setFontSize(5.1);
  const sidebarText = [
    "Les demandes en decharge ou reduction doivent etre adressees au Directeur General des Impots dans les trois mois qui suivent la notification du present avis d'imposition.",
    "Les demandes en remise ou moderation doivent etre adressees au Directeur des Impots dans le mois de l'evenement qui les motive. Celles qui sont motivees par la gene ou l'indigence peuvent etre presentees a toute epoque.",
    "Tout renseignement sur la nature des impots faisant l'objet de cet avis d'imposition peut etre demande au Service d'Assiette. Le paiement des impots se fait a la Caisse du Receveur des Impots, soit en numeraires, soit par cheque bancaire, certifie et libelle au nom du Receveur des Impots.",
  ];
  let y = 124;
  sidebarText.forEach((paragraph) => {
    const lines = wrap(pdf, paragraph, SIDEBAR_W - 4);
    pdf.text(lines, SIDEBAR_X + 2, y);
    y += lines.length * 2.4 + 1.6;
  });

  pdf.setFontSize(5.1);
  pdf.setFont("times", "normal");
  const abbrev = [
    "Abreviations : FNB = Foncier Non Bat",
    "FB = Foncier Bati   VV = Valeur Venale   VL = Valeur Locative   RN = Revenu Net",
    "PEO = Prelevement pour Enlevement des Ordures   TFU : Taxe Foncier Unique",
    "IRPP/RF = Impot sur le Revenu sur les Personnes Physiques ; categorie Revenu Foncier",
    "PORTB = Prelevement pour l'Office de Radiodiffusion et Television du Benin",
    "Mode de calcul des impots",
    "TFU/FNB = VV x Taux de la TFU/FNB",
    "TFU/FB = VL x Taux de la TFU/FB",
    "IRPP/RF = RN x taux de l'IRPP/RF",
  ];
  let abY = 159;
  abbrev.forEach((line, index) => {
    pdf.setFont("times", index === 5 ? "bold" : "normal");
    pdf.text(wrap(pdf, line, SIDEBAR_W - 4), SIDEBAR_X + 2, abY);
    abY += index === 5 ? 4 : 3.2;
  });
}

function drawStaticHeader(pdf: jsPDF, commune: string, annee: number) {
  pdf.setFont("times", "bold");
  pdf.setFontSize(15);
  pdf.text(`COMMUNE : ${commune}`, MAIN_X + MAIN_W / 2, 18, { align: "center" });
  pdf.text("TAXE FONCIERE UNIQUE", MAIN_X + MAIN_W / 2, 29, { align: "center" });
  pdf.setFontSize(11);
  pdf.text(`Annee : ${annee}`, MAIN_X + MAIN_W - 3, 27, { align: "right" });

  pdf.setLineWidth(0.4);
  pdf.rect(MAIN_X + 18, 35, MAIN_W - 36, 8, "S");
  pdf.setFontSize(12);
  pdf.text("AVIS DE MISE EN RECOUVREMENT", MAIN_X + MAIN_W / 2, 41, { align: "center" });
}

function drawRecipientBlock(pdf: jsPDF, details: AvisRecouvrementDetails) {
  const commune = normalizeCommune(details.role.commune);
  const roleLabel = `Role N°${details.role.numero_role}/${commune}/${details.role.annee}`;
  const addressParts = [
    normalizeCommune(details.contribuable.commune),
    normalizeCommune(details.contribuable.arrondissement),
    normalizeCommune(details.contribuable.quartier),
  ].filter(Boolean);
  const address = `PARCELLE DE ${toNumber(details.liquidation.superficie)} M2 ${addressParts.join("/")}`;

  pdf.setFont("times", "bold");
  pdf.setFontSize(9.6);
  pdf.text("DESTINATAIRE :", MAIN_X, 57);
  pdf.text("N° IFU/NPI :", MAIN_X, 64);
  pdf.text("ADRESSE :", MAIN_X, 71);

  pdf.setFont("times", "normal");
  pdf.text(details.contribuable.nom_prenoms, MAIN_X + 34, 57);
  pdf.text(details.contribuable.ifu_npi, MAIN_X + 34, 64);
  pdf.text(details.contribuable.telephone || "-", MAIN_X + 162, 64);
  pdf.text(wrap(pdf, address, 126), MAIN_X + 34, 71);
  pdf.setFont("times", "bold");
  pdf.text(roleLabel, MAIN_X + 34, 80);
}

function drawArticlesTable(pdf: jsPDF, rows: AvisTableRow[]) {
  const startY = 90;
  const widths = [14, 14, 24, 31, 38, 18, 12, 16, 14, 14, 18];
  const headers = [
    ["N° des", "articles"],
    ["Exercice"],
    ["NATURE D' IMPOTS"],
    ["Localisation"],
    ["Description"],
    ["Base"],
    ["Taux"],
    ["Droit", "simple"],
    ["Penalite"],
    ["Acompte", "paye"],
    ["Reste du"],
  ];

  let x = MAIN_X;
  pdf.setDrawColor(0);
  pdf.setFillColor(220, 220, 220);
  headers.forEach((headerLines, index) => {
    pdf.rect(x, startY, widths[index], 16, "FD");
    pdf.setFont("times", "bold");
    pdf.setFontSize(8.2);
    const lineStart = startY + 6;
    headerLines.forEach((line, lineIndex) => {
      pdf.text(line, x + widths[index] / 2, lineStart + lineIndex * 3.8, { align: "center" });
    });
    x += widths[index];
  });

  let y = startY + 16;
  rows.forEach((row) => {
    const values = [
      String(row.numero_article),
      String(row.exercice),
      row.nature_impot,
      row.localisation,
      row.description,
      formatNumber(row.base),
      `${Math.round(row.taux * 100)}%`,
      formatNumber(row.droit_simple),
      row.penalite > 0 ? formatNumber(row.penalite) : "-",
      row.acompte_paye > 0 ? formatNumber(row.acompte_paye) : "-",
      row.reste_du > 0 ? formatNumber(row.reste_du) : "-",
    ];

    const wrapped = values.map((value, index) => wrap(pdf, value, widths[index] - 2));
    const rowHeight = Math.max(12, ...wrapped.map((lines) => lines.length * 3.6 + 2));
    let currentX = MAIN_X;

    values.forEach((_, index) => {
      pdf.rect(currentX, y, widths[index], rowHeight);
      pdf.setFont("times", index <= 2 ? "bold" : "normal");
      pdf.setFontSize(8.1);
      const isCentered = index <= 2 || index === 6;
      const textX = isCentered ? currentX + widths[index] / 2 : currentX + 1.6;
      const textY = y + 4.8;
      pdf.text(wrapped[index], textX, textY, { align: isCentered ? "center" : "left" });
      currentX += widths[index];
    });

    y += rowHeight;
  });

  return y;
}

function drawFooter(pdf: jsPDF, details: AvisRecouvrementDetails, endY: number, totalDu: number, dateEmission: Date) {
  const blockY = endY + 4;
  const totalWidth = MAIN_W;

  pdf.setFillColor(220, 220, 220);
  pdf.rect(MAIN_X, blockY, totalWidth, 12, "FD");
  pdf.setFont("times", "bold");
  pdf.setFontSize(14);
  pdf.text("TOTAL DÛ", MAIN_X + 38, blockY + 8.2, { align: "center" });
  pdf.text(formatNumber(totalDu), MAIN_X + totalWidth - 20, blockY + 8.2, { align: "right" });

  pdf.setFont("times", "bold");
  pdf.setFontSize(9.2);
  pdf.text(
    "Rendu exécutoire en vertu des dispositions des articles 596 et 597 du Code Général des Impôts,",
    MAIN_X + totalWidth / 2,
    blockY + 18,
    { align: "center" }
  );

  const place = titleCase(normalizeCommune(details.role.commune));
  pdf.setFontSize(11);
  pdf.text(`${place}, le ${formatDateLong(dateEmission)}`, MAIN_X + totalWidth - 2, blockY + 36, { align: "right" });
  pdf.setFontSize(13);
  pdf.text("Le Chef du Service de Gestion", MAIN_X + totalWidth - 2, blockY + 50, { align: "right" });
  pdf.setFontSize(12);
  pdf.text("Hopeson HOUNSINOU", MAIN_X + totalWidth - 2, blockY + 70, { align: "right" });
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

  drawStaticSidebar(pdf, commune, dateEmission);
  drawStaticHeader(pdf, commune, annee);
  drawRecipientBlock(pdf, details);
  const endY = drawArticlesTable(pdf, rows);
  drawFooter(pdf, details, endY, totalDu, dateEmission);

  pdf.save(filename || `Avis_Recouvrement_${details.liquidation.reference_liq}.pdf`);
}