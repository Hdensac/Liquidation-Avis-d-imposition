import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type AuditLogExportItem = {
  id: string;
  user_id: string | null;
  user_email: string;
  action: string;
  details: any;
  created_at: string;
};

function sanitizeText(value: unknown): string {
  return String(value || "")
    .replace(/[\u00A0\u202F\u2009]/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatActionLabel(action: string): string {
  switch (action) {
    case "CREATION_LIQUIDATION":
      return "Création Foncier";
    case "VALIDATION_PAIEMENT":
      return "Paiement Foncier";
    case "MODIFICATION_FINANCIERE_LIQUIDATION_PAYE":
      return "Modif. Foncier";
    case "CREATION_LIQUIDATION_TPS":
      return "Création TPS";
    case "VALIDATION_PAIEMENT_TPS":
      return "Validation TPS";
    case "MODIFICATION_FINANCIERE_LIQUIDATION_TPS_VALIDE":
      return "Modif. TPS";
    case "ANNULATION_LIQUIDATION":
      return "Annulation Liq.";
    default:
      return action;
  }
}

export function summarizeLogDetails(details: any): string {
  if (!details) return "—";
  if (typeof details === "string") return sanitizeText(details);

  // 1. Compare diff objects if present (data_avant/data_apres OR avant/apres)
  const before = details.data_avant || details.avant;
  const after = details.data_apres || details.apres;

  if (before && after && typeof before === "object" && typeof after === "object") {
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const fieldLabels: Record<string, string> = {
      fullname: "Nom Complet",
      nom_raison_sociale: "Raison Sociale",
      nom_prenoms: "Nom & Prénoms",
      ifuNpi: "IFU/NPI",
      ifu_npi: "IFU/NPI",
      ifuNc: "IFU/NPI",
      ifu_nc: "IFU/NPI",
      phone: "Téléphone",
      telephone: "Téléphone",
      commune: "Commune",
      quartier: "Quartier",
      localisation: "Localisation",
      typeBien: "Type de Bien",
      type_bien: "Type de Bien",
      superficie: "Superficie",
      superficieImposable: "Superficie Imposable",
      superficie_imposable: "Superficie Imposable",
      valeurLocative: "Valeur Locative",
      valeur_locative: "Valeur Locative",
      startYear: "Année Début",
      start_year: "Année Début",
      isLoue: "Mis en location",
      is_loue: "Mis en location",
      valeurIrf: "Valeur IRF",
      valeur_irf: "Valeur IRF",
      description: "Description",
      activite: "Activité",
      montantAutresActivites: "Autres Activités",
      montant_autres_activites: "Autres Activités",
      acomptesPayes: "Acomptes Payés",
      acomptes_payes: "Acomptes Payés",
    };

    const changedFields = allKeys.filter((key) => {
      if (["reference_liq", "reference_tps", "reference", "id", "user_id", "role"].includes(key)) {
        return false;
      }
      const valBefore = before[key];
      const valAfter = after[key];
      const isEmptyBefore = valBefore === undefined || valBefore === null || valBefore === "";
      const isEmptyAfter = valAfter === undefined || valAfter === null || valAfter === "";
      if (isEmptyBefore && isEmptyAfter) return false;
      return JSON.stringify(valBefore) !== JSON.stringify(valAfter);
    });

    if (changedFields.length > 0) {
      const labels = changedFields.map((k) => fieldLabels[k] || k);
      return sanitizeText(`Modif: ${labels.join(", ")}`);
    } else {
      return "Modif. enregistrée";
    }
  }

  // 2. Standard keys extraction
  const parts: string[] = [];

  if (details.commune) parts.push(`Commune: ${details.commune}`);
  if (details.contribuable) {
    const name = typeof details.contribuable === "object"
      ? details.contribuable.nom_prenoms || details.contribuable.nom_raison_sociale
      : details.contribuable;
    if (name) parts.push(`Contrib: ${name}`);
  }
  if (details.nouveau_numero_role) parts.push(`Rôle N°${details.nouveau_numero_role}`);
  if (details.total_droits) parts.push(`Droits: ${Number(details.total_droits).toLocaleString("fr-FR")} F`);
  if (details.impot_du) parts.push(`Impôt: ${Number(details.impot_du).toLocaleString("fr-FR")} F`);
  if (details.reason) parts.push(`Motif: ${details.reason}`);
  if (details.first_article_num && details.last_article_num) {
    parts.push(`Art. ${details.first_article_num} à ${details.last_article_num}`);
  }

  if (parts.length > 0) return sanitizeText(parts.join(" | "));

  // 3. Fallback for other objects: extract keys excluding internal identifiers
  if (typeof details === "object" && details !== null) {
    const ignoredKeys = new Set([
      "reference_liq", "reference_tps", "reference", "liquidation_id",
      "recouvrement_id", "role_id", "user_id", "role", "id"
    ]);
    const cleanEntries = Object.entries(details).filter(([k]) => !ignoredKeys.has(k));
    if (cleanEntries.length > 0) {
      const summaryPairs = cleanEntries.map(([k, v]) => `${k}: ${typeof v === "object" ? "..." : String(v)}`);
      return sanitizeText(summaryPairs.join(" | "));
    }
  }

  return "—";
}

/**
 * Génère un document PDF d'audit hautement professionnel
 */
export function generateAuditPdf(
  logs: AuditLogExportItem[],
  filtersInfo?: { search?: string; action?: string; date?: string }
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Largeur A4 landscape: 297mm, Hauteur: 210mm
  const pageWidth = 297;
  const nowStr = new Date().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  // En-tête institutionnel
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RÉPUBLIQUE DU BÉNIN - ADMINISTRATION FISCALE", 14, 10);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Journal d'Audit & Traçabilité des Opérations Système", 14, 16);

  doc.setFontSize(9);
  doc.text(`Émis le : ${nowStr}`, pageWidth - 14, 14, { align: "right" });

  // Section Métadonnées & Filtres
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("SYNTHÈSE DE L'EXPORTATION", 14, 29);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  const filterActionText = filtersInfo?.action ? formatActionLabel(filtersInfo.action) : "Toutes les actions";
  const filterDateText = filtersInfo?.date === "today" ? "Aujourd'hui" : filtersInfo?.date === "week" ? "7 derniers jours" : filtersInfo?.date === "month" ? "30 derniers jours" : "Toutes les dates";
  const filterSearchText = filtersInfo?.search ? `"${filtersInfo.search}"` : "Aucune restriction";

  doc.text(`Nombre d'enregistrements : ${logs.length}`, 14, 34);
  doc.text(`Filtre Action : ${filterActionText}`, 85, 34);
  doc.text(`Période : ${filterDateText}`, 155, 34);
  doc.text(`Recherche libre : ${filterSearchText}`, 220, 34);

  // Ligne de séparation
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 37, pageWidth - 14, 37);

  // Tableau des logs
  const tableData = logs.map((log) => {
    const ref = log.details?.reference_liq || log.details?.reference_tps || "—";
    const dateFormatted = new Date(log.created_at).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    return [
      dateFormatted,
      sanitizeText(log.user_email),
      sanitizeText(log.action),
      sanitizeText(ref),
      summarizeLogDetails(log.details)
    ];
  });

  autoTable(doc, {
    startY: 40,
    margin: { left: 14, right: 14, bottom: 18 },
    head: [[
      "Date & Heure",
      "Utilisateur / Agent",
      "Action Système",
      "Référence",
      "Détails de l'Opération"
    ]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [79, 70, 229], // Indigo 600
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      valign: "middle"
    },
    columnStyles: {
      0: { cellWidth: 35, fontStyle: "bold" },
      1: { cellWidth: 55 },
      2: { cellWidth: 45, fontStyle: "bold" },
      3: { cellWidth: 32, fontStyle: "bold" },
      4: { cellWidth: "auto" }
    },
    didDrawPage: (data) => {
      // Footer pagination
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.setFont("helvetica", "italic");
      doc.text(
        `Document officiel d'audit - Administration Fiscale Béninoise | Confidentialité Strictement Réservee`,
        14,
        205
      );
      doc.text(
        `Page ${data.pageNumber} sur ${pageCount}`,
        pageWidth - 14,
        205,
        { align: "right" }
      );
    }
  });

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`Journal_Audit_Fiscal_${fileDate}.pdf`);
}

/**
 * Génère un fichier texte structuré (TXT) au format Log / SIEM Professionnel
 */
export function generateAuditTxt(
  logs: AuditLogExportItem[],
  filtersInfo?: { search?: string; action?: string; date?: string }
) {
  const nowStr = new Date().toLocaleString("fr-FR");
  const lines: string[] = [];

  lines.push("==========================================================================================");
  lines.push("               RÉPUBLIQUE DU BÉNIN - ADMINISTRATION FISCALE");
  lines.push("                      JOURNAL D'AUDIT ET DE TRAÇABILITÉ");
  lines.push("==========================================================================================");
  lines.push(`Date de génération  : ${nowStr}`);
  lines.push(`Nombre de logs      : ${logs.length}`);
  lines.push(`Recherche libre     : ${filtersInfo?.search || "Aucune"}`);
  lines.push(`Filtre Action       : ${filtersInfo?.action || "Toutes les actions"}`);
  lines.push(`Période sélectionnée: ${filtersInfo?.date || "Toutes les dates"}`);
  lines.push("==========================================================================================");
  lines.push("");

  logs.forEach((log, index) => {
    const dateFormatted = new Date(log.created_at).toLocaleString("fr-FR");
    const ref = log.details?.reference_liq || log.details?.reference_tps || "N/A";

    lines.push(`[LOG #${String(index + 1).padStart(4, "0")}] ${dateFormatted}`);
    lines.push(`  AGENT     : ${log.user_email}`);
    lines.push(`  ACTION    : ${log.action}`);
    lines.push(`  RÉFÉRENCE : ${ref}`);
    lines.push(`  DÉTAILS   : ${JSON.stringify(log.details || {})}`);
    lines.push("------------------------------------------------------------------------------------------");
  });

  lines.push("");
  lines.push("==========================================================================================");
  lines.push("                          FIN DU FICHIER DE JOURNAL D'AUDIT");
  lines.push("==========================================================================================");

  const txtContent = lines.join("\n");
  const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
  const fileDate = new Date().toISOString().slice(0, 10);

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Journal_Audit_Fiscal_${fileDate}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
