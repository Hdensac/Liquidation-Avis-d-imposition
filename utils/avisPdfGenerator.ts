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
    date_paiement: string;
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
    telephone: string;
    commune: string;
    arrondissement: string;
    quartier: string;
  };
  articles: AvisRecouvrementArticle[];
};

const PAGE_WIDTH = 297;
const LEFT_COL_X = 8;
const LEFT_COL_W = 41;
const MAIN_X = 54;
const RIGHT_MARGIN = 8;
const MAIN_W = PAGE_WIDTH - MAIN_X - RIGHT_MARGIN;

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function wrapLines(pdf: jsPDF, text: string, width: number) {
  return pdf.splitTextToSize(String(text ?? ""), width);
}

function drawCenteredBlock(pdf: jsPDF, lines: string[], x: number, y: number, width: number, fontSize = 8) {
  pdf.setFont("times", "normal");
  pdf.setFontSize(fontSize);
  let currentY = y;
  lines.forEach((line) => {
    pdf.text(line, x + width / 2, currentY, { align: "center" });
    currentY += 4.1;
  });
  return currentY;
}

function drawSidebar(pdf: jsPDF, datePaiement: string, commune: string) {
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.4);
  pdf.rect(LEFT_COL_X, 8, LEFT_COL_W, 194);

  pdf.setFont("times", "bold");
  pdf.setFontSize(9);
  drawCenteredBlock(
    pdf,
    [
      "REPUBLIQUE DU BENIN",
      "----------------------",
      "MINISTERE DE L'ECONOMIE ET",
      "DES FINANCES",
      "----------------------",
      "DIRECTION GENERALE DES",
      "IMPOTS",
      "----------------------",
      "DIRECTION DEPARTEMENTALE",
      "DES IMPOTS DE L'ATLANTIQUE",
      "******",
      "CENTRE DES IMPOTS DES",
      "PETITES ENTREPRISES",
      `D'${titleCase(commune)}`,
      "----------------------",
      "SERVICE DE GESTION",
      "----------------------",
      "RECETTE DES IMPOTS",
      `D'${titleCase(commune)}`,
    ],
    LEFT_COL_X + 1,
    15,
    LEFT_COL_W - 2,
    7.7
  );

  pdf.setFont("times", "normal");
  pdf.setFontSize(7);
  pdf.text("Date de notification", LEFT_COL_X + 1, 66);
  pdf.text(": ........./........./ 20......", LEFT_COL_X + 1, 71);
  pdf.text("Date de mise en recouvrement", LEFT_COL_X + 1, 77);
  pdf.text(`: ${formatShortDate(datePaiement)}`, LEFT_COL_X + 1, 82);
  pdf.text("Date de majoration", LEFT_COL_X + 1, 88);
  pdf.text(`: ${formatShortDate(datePaiement)}`, LEFT_COL_X + 1, 93);

  pdf.roundedRect(LEFT_COL_X - 1, 101, LEFT_COL_W + 2, 62, 4, 4);
  pdf.setFont("times", "bold");
  pdf.setFontSize(10);
  pdf.text("AVIS AUX", LEFT_COL_X + LEFT_COL_W / 2, 113, { align: "center" });
  pdf.text("CONTRIBUABLES", LEFT_COL_X + LEFT_COL_W / 2, 119, { align: "center" });
  pdf.setFont("times", "normal");
  pdf.setFontSize(5.4);
  const bodyLines = [
    "Les demandes en décharge ou réduction doivent être adressées au Directeur Général des Impôts dans les trois mois suivant la notification du présent avis.",
    "Les demandes en remise ou modération doivent être adressées au Directeur des Impôts dans le mois de l'évènement qui les motive.",
    "Tout renseignement sur la nature des impôts faisant l'objet de cet avis d'imposition peut être demandé au Service d'Assiette.",
    "Le paiement des impôts se fait à la caisse du Receveur des Impôts ou par les moyens autorisés par l'administration fiscale.",
  ];
  let y = 124;
  bodyLines.forEach((line) => {
    const wrapped = wrapLines(pdf, line, LEFT_COL_W - 4);
    pdf.text(wrapped, LEFT_COL_X + 2, y);
    y += wrapped.length * 2.8 + 1.5;
  });
}

function drawHeader(pdf: jsPDF, roleCommune: string, roleYear: number) {
  pdf.setFont("times", "bold");
  pdf.setFontSize(16);
  pdf.text(`COMMUNE : ${titleCase(roleCommune)}`, MAIN_X + MAIN_W / 2, 18, { align: "center" });
  pdf.text("TAXE FONCIERE UNIQUE", MAIN_X + MAIN_W / 2, 28, { align: "center" });
  pdf.setLineWidth(0.5);
  pdf.line(MAIN_X + 62, 38, MAIN_X + MAIN_W - 58, 38);
  pdf.setFontSize(13);
  pdf.text("AVIS DE MISE EN RECOUVREMENT", MAIN_X + MAIN_W / 2, 42, { align: "center" });
  pdf.setFontSize(11);
  pdf.text(`Année : ${roleYear}`, MAIN_X + MAIN_W - 2, 27, { align: "right" });
}

function drawRecipientBlock(pdf: jsPDF, details: AvisRecouvrementDetails) {
  const communeLabel = titleCase(details.role.commune);
  const roleLabel = `Role N°${details.role.numero_role}/${communeLabel.toUpperCase()}/${details.role.annee}`;
  const address = `PARCELLE DE ${details.liquidation.superficie} M² ${details.contribuable.commune}/${details.contribuable.arrondissement}/${details.contribuable.quartier}`;

  pdf.setFont("times", "bold");
  pdf.setFontSize(10);
  pdf.text("DESTINATAIRE :", MAIN_X, 56);
  pdf.setFont("times", "normal");
  pdf.text(details.contribuable.nom_prenoms, MAIN_X + 34, 56);

  pdf.setFont("times", "bold");
  pdf.text("N° IFU/NPI :", MAIN_X, 63);
  pdf.setFont("times", "normal");
  pdf.text(details.contribuable.ifu_npi, MAIN_X + 34, 63);
  pdf.setFont("times", "bold");
  pdf.text(`Tel : ${details.contribuable.telephone || "-"}`, MAIN_X + 145, 63);

  pdf.setFont("times", "bold");
  pdf.text("ADRESSE :", MAIN_X, 70);
  pdf.setFont("times", "normal");
  const wrappedAddress = wrapLines(pdf, address, 125);
  pdf.text(wrappedAddress, MAIN_X + 34, 70);

  pdf.setFont("times", "bold");
  pdf.text(roleLabel, MAIN_X + 34, 79);
}

function drawArticlesTable(pdf: jsPDF, details: AvisRecouvrementDetails) {
  const startY = 90;
  const tableX = MAIN_X;
  const widths = [14, 14, 24, 28, 41, 20, 12, 16, 14, 14, 17];
  const headers = [
    "N° des\narticles",
    "Exercice",
    "NATURE D' IMPOTS",
    "Localisation",
    "Description",
    "Base",
    "Taux",
    "Droit\nsimple",
    "Pénalité",
    "Acompte\npayé",
    "Reste dû",
  ];
  const headerHeight = 16;

  let x = tableX;
  pdf.setFillColor(220, 220, 220);
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  headers.forEach((header, index) => {
    pdf.rect(x, startY, widths[index], headerHeight, "FD");
    pdf.setFont("times", "bold");
    pdf.setFontSize(8.5);
    const lines = header.split("\n");
    const baseY = startY + 6;
    lines.forEach((line, lineIndex) => {
      pdf.text(line, x + widths[index] / 2, baseY + lineIndex * 4, { align: "center" });
    });
    x += widths[index];
  });

  let y = startY + headerHeight;
  details.articles.forEach((article) => {
    const values = [
      String(article.numero_article),
      String(article.exercice),
      article.nature_impot,
      article.localisation,
      article.description,
      formatNumber(article.base),
      formatPercent(article.taux),
      formatNumber(article.droit_simple),
      formatNumber(article.penalite),
      formatNumber(article.acompte_paye),
      formatNumber(article.reste_du),
    ];

    const wrapped = values.map((value, index) => wrapLines(pdf, value, widths[index] - 2));
    const rowHeight = Math.max(12, ...wrapped.map((lines) => lines.length * 3.7 + 2));
    let currentX = tableX;

    values.forEach((value, index) => {
      pdf.rect(currentX, y, widths[index], rowHeight);
      pdf.setFontSize(8.2);
      pdf.setFont("times", index <= 2 ? "bold" : "normal");
      const lines = wrapped[index];
      const textY = y + 5;
      const textX = index <= 2 || index === 6 ? currentX + widths[index] / 2 : currentX + 1.5;
      const align = index <= 2 || index === 6 ? "center" : "left";
      pdf.text(lines, textX, textY, { align: align as "left" | "center" | "right" });
      currentX += widths[index];
    });

    y += rowHeight;
  });

  return y;
}

function drawFooter(pdf: jsPDF, details: AvisRecouvrementDetails, endY: number) {
  const totalWidth = MAIN_W;
  const totalY = endY + 4;
  pdf.setFillColor(220, 220, 220);
  pdf.rect(MAIN_X, totalY, totalWidth, 12, "FD");
  pdf.setFont("times", "bold");
  pdf.setFontSize(14);
  pdf.text("TOTAL DÛ", MAIN_X + 32, totalY + 8.2, { align: "center" });
  pdf.text(formatNumber(details.articles.reduce((sum, article) => sum + article.reste_du, 0)), MAIN_X + totalWidth - 18, totalY + 8.2, {
    align: "right",
  });

  pdf.setFont("times", "bold");
  pdf.setFontSize(9.5);
  pdf.text(
    "Rendu exécutoire en vertu des dispositions des articles 596 et 597 du Code Général des Impôts,",
    MAIN_X + totalWidth / 2,
    totalY + 19,
    { align: "center" }
  );

  const dateLabelY = totalY + 38;
  const place = titleCase(details.role.commune);
  pdf.setFontSize(10.5);
  pdf.text(`${place}, le ${formatDate(details.recouvrement.date_paiement)}`, MAIN_X + totalWidth - 2, dateLabelY, {
    align: "right"
  });
  pdf.setFontSize(13);
  pdf.text("Le Chef du Service de Gestion", MAIN_X + totalWidth - 2, dateLabelY + 14, {
    align: "right"
  });
  pdf.setFontSize(12);
  pdf.text("Hopeson HOUNSINOU", MAIN_X + totalWidth - 2, dateLabelY + 34, {
    align: "right"
  });
}

export async function generateAvisRecouvrementPdf(details: AvisRecouvrementDetails, filename?: string) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  pdf.setTextColor(0, 0, 0);
  drawSidebar(pdf, details.recouvrement.date_paiement, details.role.commune);
  drawHeader(pdf, details.role.commune, details.role.annee);
  drawRecipientBlock(pdf, details);
  const endY = drawArticlesTable(pdf, details);
  drawFooter(pdf, details, endY);

  pdf.save(filename || `Avis_Recouvrement_${details.liquidation.reference_liq}.pdf`);
}