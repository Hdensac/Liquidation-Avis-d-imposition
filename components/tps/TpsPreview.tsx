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

  // Lignes secondaires (valeur = 0) : padding réduit MAIS jamais en dessous
  // de py-1, pour que la bordure ne coupe jamais le texte/chiffre à l'export PDF.
  const thinRowCellClass = "border-r border-b border-black px-1 py-1";
  const thinRowValueClass = "border-b border-black px-1 py-1 text-right font-mono";

  return (
    <div className="flex justify-center w-full">
      <div
        ref={documentRef}
        id={documentId}
        className="a4-document text-black relative p-3 bg-white border border-slate-300"
        style={{
          width: "794px",
          minHeight: "1123px",
          fontFamily: "'Times New Roman', Times, serif",
          lineHeight: 1.3,
        }}
      >
        {/* EN-TETE — 3 colonnes : Admin à gauche, Logo DGI au milieu, Titre à droite */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-1.5">
          {/* Bloc gauche : identité administrative */}
          <div className="text-[11.5px] text-left shrink-0 w-[220px]" style={{ lineHeight: 1.25 }}>
            <div>République du Bénin</div>
            <div>Ministère de l'Économie et des Finances</div>
            <div>Direction Générale des Impôts</div>
            <div className="font-bold mt-1">
              Centre des Impôts des Petites Entreprises
            </div>
            <div className="font-bold">d'{formData.commune || "Allada"}</div>
          </div>

          {/* Logo DGI au milieu en haut */}
          <div className="shrink-0 flex justify-center items-center">
            <img
              src="/dgi_lg.png"
              alt="Logo DGI"
              className="h-14 w-14 object-contain"
            />
          </div>

          {/* Bloc droit : titre de l'avis, centré dans l'espace restant */}
          <div className="flex-1 text-center">
            <div className="font-bold text-base uppercase tracking-wide">
              Avis de mise en recouvrement TPS
            </div>
            <div className="flex justify-center gap-10 font-bold text-[13px] mt-1.5">
              <span>ANNEE: {assessmentYear}</span>
              <span>EXERCICE: {exerciseYear}</span>
            </div>
            <div className="font-bold text-[13px] mt-1">
              Commune de: {formData.commune || "Allada"}
            </div>
          </div>
        </div>

        {/* DETAILS ET IDENTIFICATION CONTRIBUABLE */}
        <div className="grid grid-cols-12 gap-4 pt-2">
          {/* Côté Gauche : Dates et Rôle */}
          <div className="col-span-6 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="space-y-1.5 text-[12.5px]">
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
              <div className="pt-1 text-[12.5px] font-bold">Rôle : TPS</div>
            </div>
            <div className="text-center font-bold text-base pb-1">
              ARTICLES : {articleNumbers}
            </div>
          </div>

          {/* Côté Droit : Identification du Contribuable — fond grisé comme l'original */}
          <div className="col-span-6 border border-black bg-slate-200 p-2.5">
            <div className="text-center font-bold border-b border-black pb-1 mb-1.5 text-[12.5px]">
              Identification du contribuable
            </div>
            <table className="w-full table-fixed text-[11.5px] border-none" style={{ lineHeight: 1.3 }}>
              <colgroup>
                <col className="w-[95px]" />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <td className="font-bold py-0.5 align-top">N°IFU/NC:</td>
                  <td className="font-mono break-words">{formData.ifuNc || "A saisir"}</td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5 align-top">
                    Nom ou Raison Sociale:
                  </td>
                  <td className="font-bold break-words">
                    {formData.nomRaisonSociale || "A saisir"}
                  </td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5 align-top">Adresse:</td>
                  <td className="font-bold break-words">
                    {formData.commune
                      ? `${formData.commune}/${formData.arrondissement}/${formData.quartier}`
                      : "A saisir"}
                    {formData.localisation ? ` /${formData.localisation}` : ""}
                  </td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5 align-top">Tél:</td>
                  <td className="break-words">{formData.telephone || "-"}</td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5 align-top">QIP:</td>
                  <td className="break-words"></td>
                </tr>
                <tr>
                  <td className="font-bold py-0.5 align-top">Activité:</td>
                  <td className="break-words">{formData.activite || "A saisir"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLEAU DES RUBRIQUES */}
        <div className="pt-2">
          <table
            className="w-full table-fixed border border-black text-[12.5px]"
            style={{ borderCollapse: "collapse", lineHeight: 1.3 }}
          >
            <colgroup>
              <col className="w-[140px]" />
              <col />
              <col className="w-[150px]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-300 font-bold border-b border-black">
                <th className="border-r border-black p-1.5 text-left" colSpan={2}>
                  Rubriques
                </th>
                <th className="p-1.5 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {/* CHIFFRE D'AFFAIRES (cellule fusionnée verticalement) — lignes à 0 resserrées mais sûres */}
              <tr>
                <td
                  rowSpan={6}
                  className="border-r border-b border-black p-1 align-middle font-bold text-center"
                >
                  Chiffre d'Affaires
                </td>
                <td className={thinRowCellClass}>Exportation de biens</td>
                <td className={thinRowValueClass}>0</td>
              </tr>
              <tr>
                <td className={thinRowCellClass}>Vente de biens</td>
                <td className={thinRowValueClass}>0</td>
              </tr>
              <tr>
                <td className={thinRowCellClass}>Exportation de services</td>
                <td className={thinRowValueClass}>0</td>
              </tr>
              <tr>
                <td className="border-r border-b border-black p-1.5">Autres activités</td>
                <td className="border-b border-black p-1.5 text-right font-mono">
                  {formatMoney(formData.montantAutresActivites)}
                </td>
              </tr>
              <tr>
                <td className={thinRowCellClass}>Transport</td>
                <td className={thinRowValueClass}>0</td>
              </tr>
              <tr className="font-bold">
                <td className="border-r border-b border-black p-1.5">Total</td>
                <td className="border-b border-black p-1.5 text-right font-mono">
                  {formatMoney(formData.montantAutresActivites)}
                </td>
              </tr>

              {/* TPS */}
              <tr className="font-bold">
                <td colSpan={2} className="border-r border-b border-black p-1.5">
                  TPS
                </td>
                <td className="border-b border-black p-1.5 text-right font-mono">
                  {formatMoney(calculations.tpsCalcule)}
                </td>
              </tr>

              {/* Ligne vide (comme sur le document officiel) */}
              <tr>
                <td colSpan={2} className="border-r border-b border-black p-1 h-3">&nbsp;</td>
                <td className="border-b border-black p-1">&nbsp;</td>
              </tr>

              {/* PORTB */}
              <tr>
                <td colSpan={2} className={thinRowCellClass}>
                  PORTB
                </td>
                <td className={thinRowValueClass}>
                  {formatMoney(calculations.portb)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className={thinRowCellClass}>Pénalités</td>
                <td className={thinRowValueClass}>0</td>
              </tr>
              <tr>
                <td colSpan={2} className={thinRowCellClass}>Amendes</td>
                <td className={thinRowValueClass}>0</td>
              </tr>
              <tr>
                <td colSpan={2} className={thinRowCellClass}>PEO</td>
                <td className={thinRowValueClass}>0</td>
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
                <td colSpan={2} className="border-r border-black p-1.5">
                  Reste dû
                </td>
                <td className="border-black p-1.5 text-right font-mono">
                  {formatMoney(calculations.resteDu)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* AVIS AUX CONTRIBUABLES */}
        <div className="border border-black p-2 text-[10.5px] mt-1.5" style={{ lineHeight: 1.25 }}>
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
        <div className="text-center font-bold text-[11.5px] pt-1.5">
          Le présent avis de mise en recouvrement est rendu exécutoire en vertu des
          <br />
          dispositions des articles 596 et 597 du Code général des impôts.
        </div>

        {/* FOOTER & DATE D'EMISSION */}
        <div className="pt-1.5 flex justify-between items-end text-[11.5px]">
          <div className="w-14 h-14 border border-slate-300 bg-slate-100 flex items-center justify-center text-[8px] italic text-slate-400">
            [ QR Code ]
          </div>
          <div className="text-right font-bold space-y-2">
            <div>
              <span>
                {formData.commune ? formData.commune.toUpperCase() : "ALLADA"} , le {formattedDate}
              </span>
            </div>
            <div>
              <div>Le Chef du Service de Gestion</div>
              <div className="font-bold pt-3">HOPESON HOUNSINOU</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};