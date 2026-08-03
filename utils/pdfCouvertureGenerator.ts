/**
 * utils/pdfCouvertureGenerator.ts
 * Génère la Couverture de Synthèse de Rôle (document officiel TFU/FNB).
 * Utilise des dynamic imports pour éviter d'alourdir le bundle initial.
 */

import type { RoleCouvertureData } from "@/actions/liquidationActions";
import { numberToFrenchWords } from "@/utils/numberToFrenchWords";

function s(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u00A0\u202F\u2009]/g, " ")
    .replace(/&+/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR")
    .format(Math.round(amount))
    .replace(/[\u00A0\u202F\u2009]/g, " ") + " FCFA";
}

export async function generateCouverturePdf(data: RoleCouvertureData): Promise<void> {
  // Import dynamique : le bundle client n'est pas alourdi au chargement initial
  const jsPDFModule = await import("jspdf");
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginLeft = 15;
  const marginRight = 15;
  const contentW = pageW - marginLeft - marginRight;

  // ─────────────────────────────────────────────
  // EN-TÊTE OFFICIEL
  // ─────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Colonne gauche (République)
  const leftLines = [
    "REPUBLIQUE DU BENIN",
    "***",
    "MINISTERE DE L'ECONOMIE",
    "ET DES FINANCES",
    "***",
    "DIRECTION GENERALE",
    "DES IMPOTS (DGI)",
    "***",
    "DIRECTION DES IMPOTS",
    "DU DEPARTEMENT DE",
    "L'ATLANTIQUE",
  ];
  let y = 18;
  for (const line of leftLines) {
    if (line === "***") {
      doc.setFont("helvetica", "bold");
      doc.text("*  *  *", marginLeft + 12, y);
      doc.setFont("helvetica", "normal");
    } else {
      doc.text(s(line), marginLeft, y);
    }
    y += 4.5;
  }

  // Colonne droite (Service)
  let yr = 18;
  const rightLines = [
    "DIRECTION DES IMPOTS",
    "DU DEPARTEMENT DE",
    "L'ATLANTIQUE",
    "***",
    "SERVICE DE GESTION",
    "DES IMPOTS LOCAUX",
    "***",
    `COMMUNE DE ${s(data.commune.toUpperCase())}`,
    "***",
    "IMPÔTS LOCAUX",
    "AMR : TFU",
  ];
  for (const line of rightLines) {
    if (line === "***") {
      doc.setFont("helvetica", "bold");
      doc.text("*  *  *", pageW - marginRight - 40, yr);
      doc.setFont("helvetica", "normal");
    } else {
      doc.text(s(line), pageW - marginRight - 45, yr);
    }
    yr += 4.5;
  }

  // Ligne séparatrice
  const sepY = Math.max(y, yr) + 2;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, sepY, pageW - marginRight, sepY);

  // ─────────────────────────────────────────────
  // TITRE DU DOCUMENT
  // ─────────────────────────────────────────────
  const titleY = sepY + 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const title1 = "ETAT DE COUVERTURE";
  const title2 = `ROLE N° ${data.numero_role} — ANNEE ${data.annee}`;
  doc.text(title1, pageW / 2, titleY, { align: "center" });
  doc.setFontSize(11);
  doc.text(title2, pageW / 2, titleY + 8, { align: "center" });

  doc.setLineWidth(0.8);
  doc.line(marginLeft, titleY + 12, pageW - marginRight, titleY + 12);
  doc.line(marginLeft, titleY + 13.5, pageW - marginRight, titleY + 13.5);

  // ─────────────────────────────────────────────
  // BLOC MÉTADONNÉES
  // ─────────────────────────────────────────────
  const metaY = titleY + 22;
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");

  const meta: [string, string][] = [
    ["COMMUNE", s(data.commune.toUpperCase())],
    ["IMPOTS LOCAUX", "AMR : TFU"],
    ["SERVICE", "GESTION DES IMPOTS LOCAUX"],
    ["ARTICLES", `N° ${data.premier_article} A ${data.dernier_article}`],
    ["ANNEE", String(data.annee)],
  ];

  let metaYCurrent = metaY;
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label} :`, marginLeft, metaYCurrent);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginLeft + 35, metaYCurrent);
    metaYCurrent += 6;
  }

  // ─────────────────────────────────────────────
  // TABLEAU RÉCAPITULATIF PAR NATURE D'IMPÔT
  // ─────────────────────────────────────────────
  const tableStartY = metaYCurrent + 8;

  const tableHead = [["Nature des contributions", "Nb de cotes", "Droit simple", "Pénalité/Amende", "TOTAL"]];

  const tableBody = data.lignes_impot.map((ligne) => [
    s(ligne.nature_impot),
    String(ligne.nb_cotes),
    formatFCFA(ligne.droit_simple),
    formatFCFA(ligne.penalite),
    formatFCFA(ligne.total),
  ]);

  // Ligne de total
  tableBody.push([
    "TOTAL GÉNÉRAL",
    String(data.lignes_impot.reduce((acc, l) => acc + l.nb_cotes, 0)),
    formatFCFA(data.total_droits_simple),
    formatFCFA(data.total_penalites),
    formatFCFA(data.total_general),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: tableHead,
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [15, 52, 96],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 60 },
      1: { cellWidth: 22 },
      2: { cellWidth: 37 },
      3: { cellWidth: 37 },
      4: { cellWidth: 37 },
    },
    // Style de la dernière ligne (TOTAL GÉNÉRAL)
    didParseCell: (hookData) => {
      if (hookData.row.index === tableBody.length - 1) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [230, 230, 230];
        hookData.cell.styles.textColor = [0, 0, 0];
      }
    },
  });

  // ─────────────────────────────────────────────
  // MENTION LÉGALE D'EXÉCUTOIRE
  // ─────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 12;

  const montantEnLettres = numberToFrenchWords(data.total_general);
  const montantFormatte = formatFCFA(data.total_general);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const legalText = [
    "En vertu des articles 596 et 597 du Code Général des Impôts, le présent rôle est rendu exécutoire.",
    `Le montant total des droits mis en recouvrement s'élève à ${montantFormatte}`,
    `(${montantEnLettres}).`,
  ];

  let legalY = finalY;
  for (const line of legalText) {
    const lines = doc.splitTextToSize(s(line), contentW);
    doc.text(lines, marginLeft, legalY);
    legalY += lines.length * 5.5;
  }

  // ─────────────────────────────────────────────
  // DATE ET SIGNATURE
  // ─────────────────────────────────────────────
  const signatureY = Math.min(legalY + 14, pageH - 30);
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(s(`A Abomey-Calavi, le ${today}`), pageW - marginRight - 75, signatureY);

  doc.setFont("helvetica", "bold");
  doc.text("Le Directeur Départemental des Impôts", pageW - marginRight - 75, signatureY + 8);
  doc.setFont("helvetica", "normal");
  doc.text("de l'Atlantique", pageW - marginRight - 75, signatureY + 14);

  // Espace pour la signature manuscrite
  doc.setLineWidth(0.3);
  doc.line(pageW - marginRight - 75, signatureY + 35, pageW - marginRight, signatureY + 35);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text("Honorat FADJI", pageW - marginRight - 60, signatureY + 41);

  // ─────────────────────────────────────────────
  // PIED DE PAGE
  // ─────────────────────────────────────────────
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, pageH - 12, pageW - marginRight, pageH - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(
    s(`Couverture de Rôle N°${data.numero_role} — ${data.commune.toUpperCase()} — ${data.annee}`),
    marginLeft,
    pageH - 7
  );
  doc.text(
    s(`Généré le ${new Date().toLocaleString("fr-FR")}`),
    pageW - marginRight,
    pageH - 7,
    { align: "right" }
  );

  // ─────────────────────────────────────────────
  // TÉLÉCHARGEMENT
  // ─────────────────────────────────────────────
  const filename = `ETAT_Couverture_${s(data.commune.toUpperCase())}_Role_${data.numero_role}.pdf`;
  doc.save(filename);
}
