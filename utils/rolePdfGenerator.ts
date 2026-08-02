import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RoleSummary, RoleDetailItem } from "@/actions/liquidationActions";

function formatFCFA(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount) + " F CFA";
}

export function generateRolePdf(role: RoleSummary, items: RoleDetailItem[]) {
  const doc = new jsPDF();

  // En-tête / Titre
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`RAPPORT DE CLÔTURE DU RÔLE #${role.numero_role}`, 14, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Commune : ${role.commune}`, 14, 28);
  doc.text(`Année d'exercice : ${role.annee}`, 14, 34);
  doc.text(`Statut : CLOTURE`, 14, 40);
  doc.text(`Date du rapport : ${new Date().toLocaleDateString("fr-FR")}`, 14, 46);

  // Tableau des Avis / Liquidations
  const tableData = items.map((item) => [
    item.reference,
    item.ifu_npi,
    item.destinataire,
    item.articles_range,
    formatFCFA(item.total_droits),
  ]);

  autoTable(doc, {
    startY: 52,
    head: [["Réf. Liquidation", "IFU / NPI", "Destinataire", "Articles", "Total Droits"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [79, 70, 229] }, // Couleur Indigo-600
    styles: { fontSize: 9 },
  });

  // Résumé Financier en bas
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Avis Émis : ${role.nb_recouvrements}`, 14, finalY);
  doc.text(`Total Droits Rôle : ${formatFCFA(role.total_droits)}`, 14, finalY + 6);

  // Téléchargement direct du fichier PDF
  doc.save(`Rapport_Role_${role.numero_role}_${role.commune}.pdf`);
}