import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const generatePDFFromElement = async (
  elementId: string,
  filename: string
) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Élément #${elementId} introuvable pour l'impression PDF.`);
  }

  // Capture de l'élément HTML
  const canvas = await html2canvas(element, {
    scale: 2, // Haute résolution
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");

  // Document A4 portrait (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();   // 210 mm
  const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

  // Calcul du ratio pour adapter parfaitement sur UNE SEULE PAGE A4
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

  const finalWidth = imgWidth * ratio;
  const finalHeight = imgHeight * ratio;

  // Centrage horizontal et vertical (si besoin) sur la page A4 unique
  const imgX = (pdfWidth - finalWidth) / 2;
  const imgY = 10; // Marge haute fixe de 10mm

  // Ajouter l'image sur une seule et unique page
  pdf.addImage(imgData, "PNG", imgX, imgY, finalWidth, finalHeight);

  // Télécharger le PDF A4 sur 1 page
  pdf.save(filename);
};
