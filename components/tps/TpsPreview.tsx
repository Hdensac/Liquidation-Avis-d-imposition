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
        className="a4-document text-black text-xs space-y-4 relative p-8 bg-white border border-slate-300 font-serif leading-relaxed"
        style={{
          width: "794px",
          minHeight: "1123px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* EN-TETE */}
        <div className="flex justify-between items-start border-b border-black pb-3">
          <div>
            <div className="font-extrabold text-[13px] uppercase tracking-wide">
              République du Bénin
            </div>
            <div className="text-[11px] font-semibold text-slate-700">
              Ministère de l'Économie et des Finances
            </div>
            <div className="text-[10px] font-medium text-slate-600">
              Direction Générale des Impôts
            </div>
            <div className="text-[10px] font-bold text-slate-800 mt-1">
              Centre des Impôts des Petites Entreprises
            </div>
            <div className="text-[10px] font-semibold text-slate-700">
              d'{formData.commune || "Allada"}
            </div>
          </div>
          <div className="text-right">
            <div className="font-extrabold text-sm uppercase text-slate-800">
              AVIS DE MISE EN RECOUVREMENT TPS
            </div>
            <div className="font-bold text-[11px] mt-1 text-slate-800">
              ANNÉE: {assessmentYear} EXERCICE: {exerciseYear}
            </div>
            <div className="font-bold text-[11px] text-slate-800">
              Commune de: {formData.commune || "Allada"}
            </div>
          </div>
        </div>

        {/* DETAILS ET IDENTIFICATION CONTRIBUABLE */}
        <div className="grid grid-cols-12 gap-4 pt-2">
          {/* Côté Gauche : Dates et Rôle */}
          <div className="col-span-6 space-y-2">
            <div className="space-y-1 text-[11px]">
              <div>
                <span className="font-bold">Date de mise en recouvrement :</span> / .. / ..
              </div>
              <div>
                <span className="font-bold">Date de distribution :</span> / .. / ..
              </div>
              <div>
                <span className="font-bold">Date de majoration :</span> / .. / ..
              </div>
            </div>
            <div className="pt-2 text-xs font-extrabold">
              <div>Rôle : TPS (N° {roleNumber})</div>
              <div className="mt-1 text-slate-900 bg-slate-100 p-1 border border-slate-300 rounded inline-block">
                ARTICLES : {articleNumbers}
              </div>
            </div>
          </div>

          {/* Côté Droit : Identification du Contribuable */}
          <div className="col-span-6 border border-black p-3 bg-slate-50 rounded">
            <div className="text-center font-extrabold border-b border-black pb-1 mb-2 uppercase text-[11px] tracking-wider">
              Identification du contribuable
            </div>
            <table className="w-full text-[10px] border-none">
              <tbody>
                <tr>
                  <td className="font-bold uppercase py-0.5 w-24">N° IFU/NC:</td>
                  <td className="font-mono">{formData.ifuNc || "A saisir"}</td>
                </tr>
                <tr>
                  <td className="font-bold uppercase py-0.5">Nom/Raison:</td>
                  <td>{formData.nomRaisonSociale || "A saisir"}</td>
                </tr>
                <tr>
                  <td className="font-bold uppercase py-0.5">Adresse:</td>
                  <td className="capitalize">
                    {formData.commune
                      ? `${formData.commune}, ${formData.arrondissement}, ${formData.quartier}`
                      : "A saisir"}
                    {formData.localisation ? ` (${formData.localisation})` : ""}
                  </td>
                </tr>
                <tr>
                  <td className="font-bold uppercase py-0.5">QIP:</td>
                  <td>-</td>
                </tr>
                <tr>
                  <td className="font-bold uppercase py-0.5">Activité:</td>
                  <td className="italic">{formData.activite || "A saisir"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLEAU DES RUBRIQUES */}
        <div className="pt-3">
          <table className="w-full border-collapse border border-black text-[11px]">
            <thead>
              <tr className="bg-slate-100 text-center font-extrabold border-b border-black">
                <th className="border-r border-black p-1.5 text-left uppercase">Rubriques</th>
                <th className="p-1.5 w-36 uppercase">Montant (FCFA)</th>
              </tr>
            </thead>
            <tbody>
              {/* CHIFFRE D'AFFAIRES COLLAPSIBLE */}
              <tr className="font-bold">
                <td className="border-r border-b border-black p-1 bg-slate-50 uppercase text-[10px]">
                  Chiffre d'Affaires
                </td>
                <td className="border-b border-black p-1 text-right bg-slate-50"></td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1 pl-4">Exportation de biens</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1 pl-4">Vente de biens</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1 pl-4">Exportation de services</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr className="font-bold">
                <td className="border-r border-b border-black p-1 pl-4 bg-yellow-50">Autres activités</td>
                <td className="border-b border-black p-1 text-right font-mono bg-yellow-50">
                  {formatMoney(formData.montantAutresActivites)}
                </td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1 pl-4">Transport</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr className="font-bold bg-cyan-50">
                <td className="border-r border-b border-black p-1 uppercase">Total Chiffre d'Affaires</td>
                <td className="border-b border-black p-1 text-right font-mono">
                  {formatMoney(formData.montantAutresActivites)}
                </td>
              </tr>

              {/* TPS CALCUL */}
              <tr className="font-bold bg-emerald-50 text-emerald-900">
                <td className="border-r border-b border-black p-1">TPS (5% du Total)</td>
                <td className="border-b border-black p-1 text-right font-mono">
                  {formatMoney(calculations.tpsCalcule)}
                </td>
              </tr>

              {/* PORTB */}
              <tr className="font-bold bg-slate-50">
                <td className="border-r border-b border-black p-1">PORTB (Fixe)</td>
                <td className="border-b border-black p-1 text-right font-mono">
                  {formatMoney(calculations.portb)}
                </td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1 pl-4">Pénalités</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1 pl-4">Amendes</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1 pl-4">PEO</td>
                <td className="border-b border-black p-1 text-right font-mono">0</td>
              </tr>

              {/* TOTAUX FINAUX */}
              <tr className="font-extrabold bg-indigo-50 text-indigo-900 border-t-2 border-black">
                <td className="border-r border-b border-black p-1.5 uppercase">Impôt dû (TPS + PORTB)</td>
                <td className="border-b border-black p-1.5 text-right font-mono text-xs">
                  {formatMoney(calculations.impotDu)}
                </td>
              </tr>
              <tr className="font-bold bg-yellow-50 text-yellow-900">
                <td className="border-r border-b border-black p-1.5 uppercase pl-4">Acomptes payés</td>
                <td className="border-b border-black p-1.5 text-right font-mono text-xs">
                  {formatMoney(formData.acomptesPayes)}
                </td>
              </tr>
              <tr className="font-extrabold bg-red-50 text-red-900 border-t border-black">
                <td className="border-r border-black p-2 uppercase text-xs">Reste dû</td>
                <td className="p-2 text-right font-mono text-sm">
                  {formatMoney(calculations.resteDu)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* AVIS AUX CONTRIBUABLES */}
        <div className="border border-black p-2.5 rounded bg-slate-50 text-[9.5px] leading-relaxed space-y-1.5">
          <div className="font-bold border-b border-slate-300 pb-0.5 uppercase tracking-wide">
            Avis aux contribuables
          </div>
          <p>
            Les demandes en décharge ou réduction doivent être adressées au Directeur Général des
            Impôts dans les trois mois qui suivent la date de mise en recouvrement inscrite sur l'avis.
            Les demandes en remise ou modération doivent être adressées au Directeur dans le mois de
            l'événement qui les motive. Celles qui sont motivées par la gêne ou l'indigence peuvent
            être présentées à toute époque.
          </p>
          <p>
            Tout renseignement sur la nature des impôts faisant l'objet de cet avis d'imposition peut
            être demandé au service des impôts de la localité.
          </p>
          <p>
            Le paiement des impôts se fait à la caisse du receveur des impôts, soit en numéraires, soit
            par chèque bancaire barré ou certifié à l'ordre du Receveur des impôts.
          </p>
          <p className="font-semibold pt-1 border-t border-slate-200">
            Le présent avis de mise en recouvrement est rendu exécutoire en vertu des dispositions
            des articles 596 et 597 du Code général des impôts.
          </p>
        </div>

        {/* FOOTER & DATES D'EMISSION */}
        <div className="pt-3 flex justify-between items-end text-[10px]">
          <div className="w-16 h-16 border border-slate-300 bg-slate-100 flex items-center justify-center text-[8px] italic text-slate-400">
            [ QR Code ]
          </div>
          <div className="text-right">
            <span className="capitalize">
              A {formData.commune || "Allada"}, le {formattedDate}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
