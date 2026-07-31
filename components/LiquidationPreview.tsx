"use client";

import React from "react";
import { TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";

interface LiquidationPreviewProps {
  formData: TaxpayerInput;
  calculations: LiquidationCalculations;
  documentRef?: React.RefObject<HTMLDivElement>;
}

export const LiquidationPreview: React.FC<LiquidationPreviewProps> = ({
  formData,
  calculations,
  documentRef,
}) => {
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  };

  return (
    <div className="flex justify-center w-full">
      <div
        ref={documentRef}
        id="liquidation-document"
        className="a4-document text-black text-xs space-y-5 border border-slate-300 relative select-none"
      >
        {/* En-tête Administratif Officiel */}
        <div className="flex justify-between items-start border-b border-black pb-3">
          <div className="text-left space-y-0.5 font-serif">
            <p className="font-bold uppercase text-[11px] tracking-wide">RÉPUBLIQUE DU BÉNIN</p>
            <p className="text-[10px] text-gray-700">MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES</p>
            <p className="text-[10px] text-gray-700 font-semibold">DIRECTION GÉNÉRALE DES IMPÔTS</p>
            <p className="text-[9px] text-gray-600">DIRECTION DES IMPÔTS FONCIERS</p>
          </div>
        </div>

        {/* Titre Principal */}
        <div className="text-center my-4">
          <h1 className="text-base font-extrabold uppercase tracking-widest border-2 border-black py-2 px-4 inline-block bg-gray-50">
            LIQUIDATION 
          </h1>
          <p className="text-[10px] italic text-gray-600 mt-1">Impôt Foncier Unique (TFU / FNB)</p>
        </div>

        {/* Section Informations Contribuable */}
        <div className="border border-black p-3 space-y-2 text-[11px]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-bold uppercase text-gray-700">Nom & Prénoms : </span>
              <span className="font-semibold">{formData.fullname || "___________________________"}</span>
            </div>
            <div>
              <span className="font-bold uppercase text-gray-700">N° IFU / NPI : </span>
              <span className="font-mono font-semibold">{formData.ifuNpi || "___________________________"}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-bold uppercase text-gray-700">Téléphone : </span>
              <span>{formData.phone || "___________________________"}</span>
            </div>
            <div>
              <span className="font-bold uppercase text-gray-700"> Adresse : </span>
              <span>
                {formData.commune || "COMMUNE"} / {formData.arrondissement || "ARR."} / {formData.quartier || "QUARTIER"}
              </span>
            </div>
          </div>
        </div>

        {/* Section Caractéristiques Imposables */}
        <div className="grid grid-cols-2 gap-4 border border-black p-3 text-[11px] bg-slate-50">
          <div>
            <span className="font-bold uppercase text-gray-700">Superficie (SURF) : </span>
            <span className="font-bold text-blue-900">{calculations.surf > 0 ? `${calculations.surf} m²` : "0 m²"}</span>
          </div>
          <div>
            <span className="font-bold uppercase text-gray-700">Valeur Administrative  (VA) : </span>
            <span className="font-bold text-blue-900">{calculations.valeurLocative > 0 ? `${formatMoney(calculations.valeurLocative)} FCFA` : "0 FCFA"}</span>
          </div>
        </div>

        {/* Tableau des 4 Exercices */}
        <div className="mt-4">
          <table className="w-full border-collapse border border-black text-[10px]">
            <thead>
              <tr className="bg-gray-200 text-black uppercase font-bold text-center border-b border-black">
                <th className="border border-black p-2 w-16">Année</th>
                <th className="border border-black p-2 w-20">Nature</th>
                <th className="border border-black p-2">Adresse & Description du Bien Imposable</th>
                <th className="border border-black p-2 w-28">Base Imposable (FCFA)</th>
                <th className="border border-black p-2 w-16">Taux</th>
                <th className="border border-black p-2 w-32">Droit Simple (FCFA)</th>
              </tr>
            </thead>
            <tbody>
              {calculations.exercises.map((ex, idx) => (
                <tr key={ex.year} className="border-b border-black text-center">
                  <td className="border border-black p-2 font-bold font-mono">{ex.year}</td>
                  <td className="border border-black p-2 font-semibold">{ex.taxNature}</td>
                  
                  {/* Fusion verticale de la description sur la 1ère ligne */}
                  {idx === 0 && (
                    <td
                      rowSpan={4}
                      className="border border-black p-3 text-left align-middle font-medium italic bg-white"
                    >
                      {calculations.adresseDescription}
                    </td>
                  )}

                  <td className="border border-black p-2 text-right font-mono">
                    {formatMoney(ex.baseImposable)}
                  </td>
                  <td className="border border-black p-2 font-bold">
                    {(ex.taux * 100).toFixed(0)}%
                  </td>
                  <td className="border border-black p-2 text-right font-bold font-mono">
                    {formatMoney(ex.droitSimple)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold border-t-2 border-black">
                <td colSpan={5} className="border border-black p-2 text-right uppercase tracking-wider text-xs">
                  TOTAL GÉNÉRAL DÛ (FCFA) :
                </td>
                <td className="border border-black p-2 text-right text-sm font-mono text-blue-900 font-extrabold bg-blue-50">
                  {formatMoney(calculations.totalDu)} FCFA
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bloc d'authentification et signature */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-[10px]">
          <div className="border border-dashed border-gray-400 p-3 rounded">
            <p className="font-bold underline uppercase mb-1">Mode de Paiement & Exigibilité :</p>
            <p className="text-gray-700">Cet avis doit être acquitté auprès des caisses de la Direction Générale des Impôts ou via les services de paiement électronique homologués.</p>
          </div>
          <div className="text-center space-y-8 pt-2">
            <p className="font-bold uppercase">Le Chef du Service de Gestion</p>
            <p className="italic text-gray-500 font-mono">[Signature & Cachet Officiel]</p>
          </div>
        </div>

        {/* Pied de page */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-[8px] text-gray-500 border-t border-gray-300 pt-1 mx-8">
          Document généré automatiquement le {new Date().toLocaleDateString("fr-FR")} - Conforme aux dispositions du Code Général des Impôts
        </div>
      </div>
    </div>
  );
};
