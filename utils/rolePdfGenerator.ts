import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RoleSummary, RoleDetailItem } from "@/actions/liquidationActions";

function formatFCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR")
    .format(amount)
    .replace(/[\u00A0\u202F\u2009]/g, " ") +
    " F CFA";
}

function sanitizePdfText(value: unknown) {
  return String(value || "")
    .replace(/[\u00A0\u202F\u2009]/g, " ")
    .replace(/&+/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function generateRolePdf(role: RoleSummary, items: RoleDetailItem[]) {
  const doc = new jsPDF();

  // En-tête / Titre
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sanitizePdfText(`RAPPORT DE CLÔTURE DU RÔLE #${role.numero_role}`), 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(sanitizePdfText(`Commune : ${role.commune}`), 14, 28);
  doc.text(sanitizePdfText(`Année d'exercice : ${role.annee}`), 14, 34);
  doc.text("Statut : CLOTURE", 14, 40);
  doc.text(sanitizePdfText(`Date du rapport : ${new Date().toLocaleDateString("fr-FR")}`), 14, 46);

  // Tableau des Avis / Liquidations
  const tableData = items.map((item) => [
    sanitizePdfText(item.reference),
    sanitizePdfText(item.ifu_npi),
    sanitizePdfText(item.destinataire),
    sanitizePdfText(item.articles_range),
    formatFCFA(item.total_droits),
  ]);

  autoTable(doc, {
    startY: 52,
    head: [[
      sanitizePdfText("Réf. Liquidation"),
      sanitizePdfText("IFU / NPI"),
      sanitizePdfText("Destinataire"),
      sanitizePdfText("Articles"),
      sanitizePdfText("Total Droits"),
    ]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
    styles: { fontSize: 9, halign: "left" },
    bodyStyles: { font: "helvetica", fontStyle: "normal" },
    didParseCell: (data) => {
      data.cell.text = data.cell.text.map((line) => sanitizePdfText(line));
    },
  });

  // Résumé Financier en bas
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.text(sanitizePdfText(`Total Avis Émis : ${role.nb_recouvrements}`), 14, finalY);
  doc.text(sanitizePdfText(`Total Droits Rôle : ${formatFCFA(role.total_droits)}`), 14, finalY + 6);

  // Téléchargement direct du fichier PDF
  doc.save(`Rapport_Role_${role.numero_role}_${role.commune}.pdf`);
}