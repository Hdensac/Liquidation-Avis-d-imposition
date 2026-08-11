"use client";

import React, { useMemo } from "react";
import { TpsInput, buildTpsCalculations } from "@/utils/tpsCalculations";

interface TpsPreviewProps {
  formData: TpsInput;
  articleNumbers?: string; // Ex: "4981, 4982"
  roleNumber?: string | number; // Ex: "1"
  dateEmission?: string; // Ex: "mardi 11 août 2026"
  documentId?: string;
  documentRef?: React.RefObject<HTMLDivElement>;
}

export const TpsPreview: React.FC<TpsPreviewProps> = ({
  formData,
  articleNumbers = "A Générer",
  roleNumber = "1",
  dateEmission = "",
  documentId = "tps-document",
  documentRef,
}) => {
  const calculations = useMemo(() => {
    return buildTpsCalculations({
      montantAutresActivites: formData.montantAutresActivites,
      acomptesPayes: formData.acomptesPayes,
      startYear: formData.startYear,
    });
  }, [formData]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  };

  const formattedDate = useMemo(() => {
    if (dateEmission) return dateEmission;
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date().toLocaleDateString("fr-FR", options);
  }, [dateEmission]);

  const assessmentYear = new Date().getFullYear();
  const exerciseYear = calculations.startYear;

  return (
    <div className="flex justify-center w-full">
      <div
        ref={documentRef}
        id={documentId}
        className="a4-document text-black text-xs space-y-3 relative p-8 bg-white border border-slate-300 font-serif leading-relaxed"
        style={{
          width: "794px",
          minHeight: "1123px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* EN-TETE */}
        <div className="border-b-2 border-black pb-2 relative min-h-[90px]">
          <div className="absolute left-0 top-0 text-[10px] leading-tight text-left">
            <div>République du Bénin</div>
            <div>Ministère de l'Économie et des Finances</div>
            <div>Direction Générale des Impôts</div>
            <div className="font-bold mt-1">
              Centre des Impôts des Petites Entreprises
            </div>
            <div className="font-bold">d'{formData.commune || "Allada"}</div>
          </div>

          <div className="text-center">
            <div className="font-bold text-sm uppercase tracking-wide">
              Avis de mise en recouvrement TPS
            </div>
            <div className="flex justify-center gap-10 font-bold text-[11px] mt-1">
              <span>ANNÉE: {assessmentYear}</span>
              <span>EXERCICE: {exerciseYear}</span>
            </div>
            <div className="font-bold text-[11px] mt-0.5">
              Commune de: {formData.commune || "Allada"}
            </div>
          </div>
        </div>

        {/* DETAILS ET IDENTIFICATION CONTRIBUABLE */}
        <div className="grid grid-cols-12 gap-4 pt-2">
          {/* Côté Gauche : Dates et Rôle */}
          <div className="col-span-6 space-y-3">
            <div className="space-y-1.5 text-[11px]">
              <div>
                <span className="font-bold">Date de mise en recouvrement :</span> ……/…../…….
              </div>
              <div>
                <span className="font-bold">Date de distribution :</span> ……/…../…….
              </div>
              <div>
                <span className="font-bold">Date de majoration :</span> ……/…../…….
              </div>
            </div>
            <div className="pt-2 text-[11px] font-bold">
              Rôle : TPS
            </div>
            <div className="text-center font-bold text-xs">
              ARTICLES : {articleNumbers}
            </div>
          </div>

          {/* Côté Droit : Identification du Contribuable */}
          <div className="col-span-6 border border-black p-2">
            <div className="text-center font-bold border-b border-black pb-1 mb-2 text-[11px]">
              Identification du contribuable
            </div>
            <table className="w-full text-[10px] border-none">
              <tbody>
                <tr>
                  <td className="font-bold py-0.5 w-24 align-top">N°IFU/NC:</td>
                  <td className="font-mono">{formData.ifuNc || "A saisir"}</td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5 align-top">Nom ou Raison Sociale:</td>
                  <td className="font-bold">{formData.nomRaisonSociale || "A saisir"}</td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5 align-top">Adresse:</td>
                  <td className="font-bold">
                    {formData.commune
                      ? `${formData.commune}/${formData.arrondissement}/${formData.quartier}`
                      : "A saisir"}
                    {formData.localisation ? ` /${formData.localisation}` : ""}
                  </td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5">QIP:</td>
                  <td></td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5">Activité:</td>
                  <td>{formData.activite || "A saisir"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLEAU DES RUBRIQUES */}
        <div className="pt-3">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-black">
                <th className="border-r border-black p-1.5 text-left" colSpan={2}>
                  Rubriques
                </th>
                <th className="p-1.5 w-32 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {/* CHIFFRE D'AFFAIRES (cellule fusionnée) */}
              <tr>
                <td
                  rowSpan={6}
                  className="border-r border-b border-black p-1 align-middle font-bold w-28"
                >
                  Chiffre d'Affaires
                </td>
                <td className="border-r border-b border-black p-1">Exportation de biens</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Vente de biens</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Exportation de services</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Autres activités</td>
                <td className="border-b border-black p-1 text-right font-mono">
                  {formatMoney(formData.montantAutresActivites)}
                </td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1">Transport</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr className="font-bold">
                <td className="border-r border-b border-black p-1">Total</td>
                <td className="border-b border-black p-1 text-right font-mono">
                  {formatMoney(formData.montantAutresActivites)}
                </td>
              </tr>

              {/* TPS */}
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1">
                  TPS
                </td>
                <td className="border-b border-black p-1 text-right font-mono">
                  {formatMoney(calculations.tpsCalcule)}
                </td>
              </tr>

              {/* Ligne vide (comme sur le document original) */}
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1">&nbsp;</td>
                <td className="border-b border-black p-1">&nbsp;</td>
              </tr>

              {/* PORTB */}
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1">
                  PORTB
                </td>
                <td className="border-b border-black p-1 text-right font-mono">
                  {formatMoney(calculations.portb)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1">Pénalités</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1">Amendes</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1">PEO</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>

              {/* TOTAUX FINAUX */}
              <tr className="font-bold">
                <td colSpan={2} className="border-r border-b border-black p-1.5">
                  Impôt du
                </td>
                <td className="border-b border-black p-1.5 text-right font-mono">
                  {formatMoney(calculations.impotDu)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1.5">
                  Acomptes payés
                </td>
                <td className="border-b border-black p-1.5 text-right font-mono">
                  {formatMoney(formData.acomptesPayes)}
                </td>
              </tr>
              <tr className="font-bold">
                <td colSpan={2} className="border-r border-black p-2">
                  Reste dû
                </td>
                <td className="border-black p-2 text-right font-mono">
                  {formatMoney(calculations.resteDu)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* AVIS AUX CONTRIBUABLES */}
        <div className="border border-black p-2.5 text-[9.5px] leading-relaxed">
          <div className="font-bold uppercase mb-1">Avis aux contribuables</div>
          <ul className="space-y-1 list-disc pl-4">
            <li>
              Les demandes en décharge ou réduction doivent être adressées au Directeur Général des
              Impôts dans les trois mois qui suivent la date de mise en recouvrement inscrite sur l'avis.
              Les demandes en remise ou modération doivent être adressées au Directeur dans le mois de
              l'événement qui les motive. Celles qui sont motivées par la gêne ou l'indigence peuvent
              être présentées à toute époque.
            </li>
            <li>
              Tout renseignement sur la nature des impôts faisant l'objet de cet avis d'imposition peut
              être demandé au service des impôts de la localité.
            </li>
            <li>
              Le paiement des impôts se fait à la caisse du receveur des impôts, soit en numéraires, soit
              par chèque bancaire barré ou certifié à l'ordre du Receveur des impôts.
            </li>
          </ul>
        </div>

        {/* MENTION LEGALE CENTREE */}
        <div className="text-center font-bold text-[10px] pt-1">
          Le présent avis de mise en recouvrement est rendu exécutoire en vertu des
          <br />
          dispositions des articles 596 et 597 du Code général des impôts.
        </div>

        {/* FOOTER & DATE D'EMISSION */}
        <div className="pt-2 flex justify-between items-end text-[10px]">
          <div className="w-16 h-16 border border-slate-300 bg-slate-100 flex items-center justify-center text-[8px] italic text-slate-400">
            [ QR Code ]
          </div>
          <div className="text-right font-bold">
            <span>
              A {formData.commune || "Allada"}, le {formattedDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};