import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { TaxpayerDetail } from "@/actions/taxpayerActions";

function sanitizeText(value: unknown): string {
  return String(value || "")
    .replace(/[\u00A0\u202F\u2009]/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} F CFA`;
}

export function generateTaxpayerAttestationPdf(taxpayer: TaxpayerDetail) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = 15;

  // 1. En-tête Institutionnel (République du Bénin)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("RÉPUBLIQUE DU BÉNIN", margin, currentY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES", margin, currentY + 4);
  doc.text("DIRECTION GÉNÉRALE DES IMPÔTS", margin, currentY + 8);

  const currentDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.text(`Émis le : ${currentDate}`, pageWidth - margin, currentY, { align: "right" });

  currentY += 16;

  // Séparateur
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // Titre principal
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(margin, currentY, pageWidth - margin * 2, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("ATTESTATION DE SITUATION FISCALE DU CONTRIBUABLE", pageWidth / 2, currentY + 8, { align: "center" });

  currentY += 18;

  // 2. Fiche d'Identité du Contribuable
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 28, 2, 2, "FD");

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  // Ligne 1
  doc.setFont("helvetica", "bold");
  doc.text("Nom / Raison Sociale :", margin + 4, currentY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(sanitizeText(taxpayer.name), margin + 42, currentY + 7);

  doc.setFont("helvetica", "bold");
  doc.text("IFU / NPI :", margin + 115, currentY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(sanitizeText(taxpayer.ifu), margin + 135, currentY + 7);

  // Ligne 2
  doc.setFont("helvetica", "bold");
  doc.text("Téléphone :", margin + 4, currentY + 16);
  doc.setFont("helvetica", "normal");
  doc.text(sanitizeText(taxpayer.phone), margin + 42, currentY + 16);

  doc.setFont("helvetica", "bold");
  doc.text("Commune Principale :", margin + 115, currentY + 16);
  doc.setFont("helvetica", "normal");
  doc.text(sanitizeText(taxpayer.commune), margin + 152, currentY + 16);

  // Ligne 3: Statut fiscal
  const isUpToDate = taxpayer.balanceDue === 0;
  doc.setFont("helvetica", "bold");
  doc.text("Statut de Régularité :", margin + 4, currentY + 24);
  
  if (isUpToDate) {
    doc.setTextColor(22, 101, 52); // green-800
    doc.text("À JOUR DE SES OBLIGATIONS (0 F ARRIÉRÉ)", margin + 42, currentY + 24);
  } else {
    doc.setTextColor(185, 28, 28); // red-700
    doc.text(`SOLDE DÉBITEUR (${formatAmount(taxpayer.balanceDue)})`, margin + 42, currentY + 24);
  }

  currentY += 34;

  // 3. Section A: Biens Fonciers & Activités Déclarées
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text("1. PATRIMOINE FONCIER ET ÉTABLISSEMENTS TPS", margin, currentY);

  currentY += 4;

  const propRows = taxpayer.properties.map((p) => [
    "TFU (Foncier)",
    p.commune,
    p.typeBien === "BATI" ? "Foncier Bâti" : "Non Bâti",
    p.superficie > 0 ? `${p.superficie.toLocaleString("fr-FR")} m²` : "—",
    p.valeurLocative > 0 ? formatAmount(p.valeurLocative) : "—",
    p.referenceLiq,
  ]);

  const actRows = taxpayer.activities.map((a) => [
    "TPS (Synthétique)",
    a.commune,
    a.activite,
    "—",
    "—",
    a.referenceTps,
  ]);

  const combinedAssets = [...propRows, ...actRows];

  if (combinedAssets.length > 0) {
    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["Type", "Commune", "Description / Nature", "Superficie", "Valeur Locative", "Réf. Origine"]],
      body: combinedAssets,
      theme: "striped",
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: 255,
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
      },
      styles: {
        cellPadding: 2,
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Aucun bien ni établissement enregistré.", margin, currentY + 4);
    currentY += 10;
  }

  // 4. Section B: Historique Chronologique des Liquidations
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text("2. HISTORIQUE DES LIQUIDATIONS ET AVIS D'IMPOSITION ÉMIS", margin, currentY);

  currentY += 4;

  const liqRows = taxpayer.liquidations.map((l) => [
    new Date(l.created_at).toLocaleDateString("fr-FR"),
    l.type,
    l.reference,
    l.commune,
    String(l.startYear),
    formatAmount(l.totalDroits),
    l.status === "PAYE" || l.status === "VALIDE" ? "PAYÉ" : "EN ATTENTE",
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["Date", "Impôt", "Référence Avis", "Commune", "Exercice", "Montant Dû", "Statut Paiement"]],
    body: liqRows,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
    },
    columnStyles: {
      5: { halign: "right", fontStyle: "bold" },
      6: { halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const text = data.cell.raw;
        if (text === "PAYÉ") {
          data.cell.styles.textColor = [22, 101, 52];
        } else {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // 5. Synthèse Financière Recap
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 22, 2, 2, "FD");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);

  doc.text("RÉCAPITULATIF FINANCIER :", margin + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.text(`Total des droits liquidés : ${formatAmount(taxpayer.totalLiquidated)}`, margin + 4, currentY + 14);
  doc.text(`Total des recouvrements effectués : ${formatAmount(taxpayer.totalPaid)}`, margin + 85, currentY + 14);

  doc.setFont("helvetica", "bold");
  if (taxpayer.balanceDue === 0) {
    doc.setTextColor(22, 101, 52);
    doc.text("SOLDE RESTANT DÛ : 0 F CFA", margin + 4, currentY + 19);
  } else {
    doc.setTextColor(185, 28, 28);
    doc.text(`SOLDE RESTANT DÛ : ${formatAmount(taxpayer.balanceDue)}`, margin + 4, currentY + 19);
  }

  currentY += 30;

  // Bloc signature
  if (currentY > pageHeight - 30) {
    doc.addPage();
    currentY = 15;
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Visa et Cachet du Chef de Centre Fiscal :", pageWidth - margin - 60, currentY);

  // Téléchargement PDF
  const filename = `Attestation_Fiscale_${sanitizeText(taxpayer.name).replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
