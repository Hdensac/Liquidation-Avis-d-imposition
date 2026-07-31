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

  // Configuration de haute résolution pour la capture
  const canvas = await html2canvas(element, {
    scale: 2, // Résolution Retina 2x
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  
  // Format standard A4 (210mm x 297mm)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  // Si le contenu dépasse une page A4
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(filename);
};
