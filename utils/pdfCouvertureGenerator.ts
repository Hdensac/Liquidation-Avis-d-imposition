import type { RoleCouvertureData } from "@/actions/liquidationActions";
import { numberToFrenchWords } from "@/utils/numberToFrenchWords";

function formatNumber(amount: number): string {
  return new Intl.NumberFormat("fr-FR")
    .format(Math.round(amount))
    .replace(/[\u00A0\u202F\u2009]/g, " ");
}

export async function generateCouverturePdf(data: RoleCouvertureData): Promise<void> {
  const jsPDFModule = await import("jspdf");
  const jsPDF = jsPDFModule.default;
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;

  // Document A4 en mode PAYSAGE (Landscape)
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // ==========================================
  // PAGE 1 : EN-TÊTE, MÉTA-DONNÉES & TABLEAU
  // ==========================================

  // --- Bloc Gauche : En-tête Officiel (Centré sur x = 55) ---
  const leftX = 55;
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text("REPUBLIQUE DU BENIN", leftX, 15, { align: "center" });
  
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  doc.text("Fraternité - Justice - Travail", leftX, 19, { align: "center" });
  doc.text("*******", leftX, 23, { align: "center" });
  
  doc.setFont("times", "bold");
  doc.text("MINISTÈRE DE L'ECONOMIE ET DES FINANCES", leftX, 27, { align: "center" });
  doc.setFont("times", "normal");
  doc.text("*******", leftX, 31, { align: "center" });
  
  doc.setFont("times", "bold");
  doc.text("DIRECTION GÉNÉRALE DES IMPÔTS", leftX, 35, { align: "center" });
  doc.setFont("times", "normal");
  doc.text("*******", leftX, 39, { align: "center" });
  
  doc.text("DIRECTION DEPARTEMANTALE DES IMPOTS DE", leftX, 43, { align: "center" });
  doc.text("L'ATLANTIQUE", leftX, 47, { align: "center" });
  doc.text("*******", leftX, 51, { align: "center" });
  
  doc.setFont("times", "bold");
  doc.text("CENTRE DES IMPÔTS DES PETITES ENTREPRISES", leftX, 55, { align: "center" });
  doc.text(`D'${data.commune.toUpperCase()}`, leftX, 59, { align: "center" });

  // --- Bloc Droit : Méta-données Géantes ---
  const rightX = 130;
  doc.setFont("times", "bold");
  doc.setFontSize(18);

  doc.text(`COMMUNE : ${data.commune.toUpperCase()}`, rightX, 25);
  doc.text("IMPOTS LOCAUX", rightX, 38);
  doc.text("AMR : TFU", rightX, 51);

  doc.text("SERVICE : GESTION", rightX, 72);

  // Articles & Année
  const artCenter = 120;
  doc.text(`ARTICLE :   ${data.premier_article}   A   ${data.dernier_article}`, artCenter, 92);

  const anneeEspacee = String(data.annee).split("").join(" ");
  doc.text(`ANNEE   :         ${anneeEspacee}`, artCenter, 108);

  // --- Tableau Récapitulatif ---
  const tableHead = [["Nature des contributions", "Nombre de cotes", "Droit simple", "Pénalité/Amende", "Total"]];

  const tableBody = data.lignes_impot.map((l) => [
    l.nature_impot,
    String(l.nb_cotes),
    formatNumber(l.droit_simple),
    formatNumber(l.penalite),
    formatNumber(l.total),
  ]);

  tableBody.push([
    "TOTAL",
    String(data.lignes_impot.reduce((acc, l) => acc + l.nb_cotes, 0)),
    formatNumber(data.total_droits_simple),
    formatNumber(data.total_penalites),
    formatNumber(data.total_general),
  ]);

  autoTable(doc, {
    startY: 120,
    margin: { left: 20, right: 20 },
    head: tableHead,
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: [120, 120, 120],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      font: "times",
      fontSize: 11,
      halign: "center",
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      font: "times",
      fontSize: 10,
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [180, 180, 180],
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 85 },
      1: { halign: "center", cellWidth: 40 },
      2: { halign: "center", cellWidth: 45 },
      3: { halign: "center", cellWidth: 45 },
      4: { halign: "center", cellWidth: 42 },
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === tableBody.length - 1) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ==========================================
  // PAGE 2 : EXÉCUTOIRE ET SIGNATURE
  // ==========================================
  doc.addPage("a4", "landscape");

  const startYPage2 = 45;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);

  const premierArtPadded = String(data.premier_article).padStart(2, "0");
  const dernierArtPadded = String(data.dernier_article).padStart(2, "0");
  const montantLettres = numberToFrenchWords(data.total_general);
  const montantChiffres = formatNumber(data.total_general);

  const prefixeText = `Les avis de mise en recouvrement de la TFU (Role N°${data.numero_role}/${data.annee}) dont les articles sont compris entre ${premierArtPadded} et ${dernierArtPadded} (commune d’${data.commune.toUpperCase()}), s’élevant à la somme de `;
  const grasText = `${montantLettres} (${montantChiffres}) FCFA`;
  const suffixeText = `, sont rendus exécutoires en vertu des dispositions des articles 596 et 597 du Code général des impôts.`;

  doc.text(prefixeText, 25, startYPage2, { maxWidth: 245, align: "justify" });
  
  doc.setFont("helvetica", "bold");
  doc.text(grasText, 25, startYPage2 + 12, { maxWidth: 245 });
  
  doc.setFont("helvetica", "normal");
  doc.text(suffixeText, 25, startYPage2 + 24, { maxWidth: 245 });

  // --- Bloc Signature ---
  const signY = startYPage2 + 55;
  
  doc.text("A Abomey-Calavi, le", pageW / 2, signY, { align: "center" });
  doc.text("Le Directeur Départemental des Impôts de l’Atlantique.", pageW / 2, signY + 18, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Honorat  FADJI", pageW / 2, signY + 48, { align: "center" });

  doc.save(`ETAT_Couverture_${data.commune.toUpperCase()}_Role_${data.numero_role}.pdf`);
}