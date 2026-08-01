import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DataAvisPDF {
  commune: string;
  anneeExercice: number;
  directionDepartementale?: string;
  centreImpots?: string;
  recetteImpots?: string;
  
  // Destinataire
  nomPrenom: string;
  ifu: string;
  telephone: string;
  adresseParcelle: string;
  numeroRole: string; // Ex: "Role N°1/COTONOU/2026"
  
  // Dates
  dateNotification?: string;
  dateMiseEnRecouvrement?: string;
  dateMajoration?: string;
  dateEmission: string;
  chefServiceNom?: string;

  // Lignes de calcul
  lignes: Array<{
    numeroArticle: number;
    exercice: number;
    natureImpot: string;
    localisation: string;
    description: string;
    base: string | number;
    taux: string;
    droitSimple: number;
    penalite: number;
    acomptePaye: number;
    resteDu: number;
  }>;
  totalDu: number;
}

export const generateAvisPDF = (data: DataAvisPDF) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [40, 40, 40];
  const tableHeaderBg = [220, 220, 220]; // Gris clair officiel DGI

  // ==========================================
  // 1. BLOC GAUCHE (Entête Administrative & AVIS)
  // ==========================================
  
  // Cadre externe gauche
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(8, 8, 55, 194); // Box administrative gauche

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('REPUBLIQUE DU BENIN', 355, 14, { align: 'center' });
  doc.text('------------------', 35.5, 17, { align: 'center' });
  doc.text('MINISTERE DE L\'ECONOMIE ET DES FINANCES', 35.5, 21, { align: 'center' });
  doc.text('------------------', 35.5, 24, { align: 'center' });
  doc.text('DIRECTION GENERALE DES IMPOTS', 35.5, 28, { align: 'center' });
  doc.text('------------------', 35.5, 31, { align: 'center' });
  
  doc.setFontSize(6.5);
  doc.text(`DIRECTION DEPARTEMENTALE\nDES IMPOTS DE L'ATLANTIQUE`, 35.5, 35, { align: 'center' });
  doc.text('******', 35.5, 41, { align: 'center' });
  doc.text(`CENTRE DES IMPOTS DES\nPETITES ENTREPRISES\nD'${data.commune.toUpperCase()}`, 35.5, 45, { align: 'center' });
  doc.text('------------------', 35.5, 53, { align: 'center' });
  doc.text('SERVICE DE GESTION', 35.5, 57, { align: 'center' });
  doc.text('------------------', 35.5, 60, { align: 'center' });
  doc.text(`RECETTE DES IMPOTS\nD'${data.commune.toUpperCase()}`, 35.5, 64, { align: 'center' });

  // Champs de dates à remplir à la main ou auto
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(`Date de notification :\n........../........../20.....`, 11, 75);
  doc.text(`Date de mise en rec. :\n${data.dateMiseEnRecouvrement || '........../........../20.....'}`, 11, 85);
  doc.text(`Date de majoration :\n${data.dateMajoration || '........../........../20.....'}`, 11, 95);

  // Bloc "AVIS AUX CONTRIBUABLES"
  doc.roundedRect(10, 108, 51, 90, 3, 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('AVIS AUX\nCONTRIBUABLES', 35.5, 115, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.2);
  const textAvis = 
    "Les demandes en décharge ou réduction doivent être adressées au Directeur Général des Impôts dans les trois mois suivant la notification du présent avis.\n\n" +
    "Les demandes en remise ou modération doivent être adressées au Directeur Général des Impôts dans le mois de l'événement qui les motive.\n\n" +
    "Tout renseignement sur la nature des impôts faisant l'objet de cet avis d'imposition peut être demandé au Service d'Assiette.\n\n" +
    "Le paiement des impôts se fait à la caisse du Receveur des Impôts.";
  doc.text(doc.splitTextToSize(textAvis, 47), 12, 126);

  // ==========================================
  // 2. EN-TÊTE PRINCIPALE (COMMUNE & DESTINATAIRE)
  // ==========================================
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`COMMUNE : ${data.commune.toUpperCase()}`, 165, 16, { align: 'center' });
  doc.setFontSize(12);
  doc.text('TAXE FONCIERE UNIQUE', 165, 22, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Année : ${data.anneeExercice}`, 280, 22, { align: 'right' });

  // Banner "AVIS DE MISE EN RECOUVREMENT"
  doc.setFillColor(240, 240, 240);
  doc.rect(110, 26, 110, 7, 'F');
  doc.setLineWidth(0.4);
  doc.rect(110, 26, 110, 7, 'S');
  doc.setFontSize(10);
  doc.text('AVIS DE MISE EN RECOUVREMENT', 165, 31, { align: 'center' });

  // Infos Destinataire
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATAIRE :', 68, 42);
  doc.text('N° IFU/NPI :', 68, 48);
  doc.text('ADRESSE :', 68, 54);

  doc.setFont('helvetica', 'normal');
  doc.text(data.nomPrenom, 100, 42);
  doc.text(data.ifu, 100, 48);
  doc.text(`Tel : ${data.telephone}`, 210, 48);
  doc.text(data.adresseParcelle, 100, 54);

  doc.setFont('helvetica', 'bold');
  doc.text(data.numeroRole, 100, 61);

  // ==========================================
  // 3. TABLEAU D'IMPOSITION (autoTable)
  // ==========================================

  const tableBody = data.lignes.map(l => [
    l.numeroArticle.toString(),
    l.exercice.toString(),
    l.natureImpot,
    l.localisation,
    l.description,
    typeof l.base === 'number' ? l.base.toLocaleString('fr-FR') : l.base,
    l.taux,
    l.droitSimple > 0 ? l.droitSimple.toLocaleString('fr-FR') : '-',
    l.penalite > 0 ? l.penalite.toLocaleString('fr-FR') : '-',
    l.acomptePaye > 0 ? l.acomptePaye.toLocaleString('fr-FR') : '-',
    l.resteDu > 0 ? l.resteDu.toLocaleString('fr-FR') : '-'
  ]);

  autoTable(doc, {
    startY: 66,
    margin: { left: 68, right: 10 },
    head: [[
      'N° des\narticles', 
      'Exercice', 
      'NATURE D\' IMPOTS', 
      'Localisation', 
      'Description', 
      'Base', 
      'Taux', 
      'Droit simple', 
      'Pénalité', 
      'Acompte\npayé', 
      'Reste dû'
    ]],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
      lineColor: [0, 0, 0]
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontSize: 7.5,
      valign: 'middle',
      lineWidth: 0.2,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 42 },
      4: { halign: 'left', cellWidth: 42 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'right', cellWidth: 18 },
      8: { halign: 'right', cellWidth: 15 },
      9: { halign: 'right', cellWidth: 15 },
      10: { halign: 'right', cellWidth: 18 }
    }
  });

  // Position après le tableau
  const finalY = (doc as any).lastAutoTable.finalY + 3;

  // ==========================================
  // 4. TOTAL DÛ ET SIGNATURES
  // ==========================================

  // Cadre TOTAL DÛ
  doc.setFillColor(235, 235, 235);
  doc.rect(68, finalY, 219, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL DÛ', 110, finalY + 5.5);
  doc.text(`${data.totalDu.toLocaleString('fr-FR')} FCFA`, 280, finalY + 5.5, { align: 'right' });

  // Formule légale exécutoire
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    'Rendu exécutoire en vertu des dispositions des articles 596 et 597 du Code Général des Impôts,',
    177, 
    finalY + 14, 
    { align: 'center' }
  );

  // Date et Signature
  doc.setFontSize(9);
  doc.text(`${data.commune}, le ${data.dateEmission}`, 230, finalY + 24);
  doc.setFontSize(10);
  doc.text('Le Chef du Service de Gestion', 230, finalY + 30);
  
  if (data.chefServiceNom) {
    doc.text(data.chefServiceNom, 230, finalY + 45);
  }

  // Téléchargement du fichier
  doc.save(`Avis_Recouvrement_${data.ifu}_${data.anneeExercice}.pdf`);
};