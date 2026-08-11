"use client";

import React, { useState, useEffect } from "react";
import { TpsInput, buildTpsCalculations } from "@/utils/tpsCalculations";
import { COMMUNE_OPTIONS, ARRONDISSEMENTS_PAR_COMMUNE } from "@/components/TaxForm";
import { User, MapPin, Building, Calendar, RefreshCw, Landmark } from "lucide-react";

interface TpsFormProps {
  formData: TpsInput;
  onChange: (data: TpsInput) => void;
  onReset: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export const TpsForm: React.FC<TpsFormProps> = ({
  formData,
  onChange,
  onReset,
  onSubmit,
  isSubmitting = false,
}) => {
  const calculations = buildTpsCalculations({
    montantAutresActivites: formData.montantAutresActivites,
    acomptesPayes: formData.acomptesPayes,
    startYear: formData.startYear,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value, type } = e.target;

    if (name === "ifuNc") {
      // Nettoie pour ne garder que les chiffres et caractères valides
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }

    if (type === "number") {
      const numValue = value === "" ? 0 : parseFloat(value);
      onChange({
        ...formData,
        [name]: numValue,
      });
    } else {
      onChange({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleCommuneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...formData,
      commune: e.target.value,
      arrondissement: "", // Réinitialiser l'arrondissement pour assurer la cohérence
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-600" />
            Paramètres d'Imposition TPS
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Saisissez les informations du contribuable et le chiffre d'affaires pour calculer la TPS.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          title="Réinitialiser les données"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {/* SECTION 1: IDENTIFICATION DU CONTRIBUABLE */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-emerald-600" />
            Identification du Contribuable
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                N° IFU / NC <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="ifuNc"
                value={formData.ifuNc}
                onChange={handleChange}
                required
                placeholder="Ex: 3201201509900"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nom ou Raison Sociale <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nomRaisonSociale"
                value={formData.nomRaisonSociale}
                onChange={handleChange}
                required
                placeholder="Ex: ETS DUBOIS ET FILS"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Téléphone
              </label>
              <input
                type="text"
                name="telephone"
                value={formData.telephone ?? ""}
                onChange={handleChange}
                placeholder="Ex: +229 97 00 00 00"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Activité principale <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="activite"
                value={formData.activite}
                onChange={handleChange}
                required
                placeholder="Ex: Commerce général, Services..."
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: ADRESSE & LOCALISATION */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Adresse & Localisation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Commune <span className="text-red-500">*</span>
              </label>
              <select
                name="commune"
                value={formData.commune}
                onChange={handleCommuneChange}
                required
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Sélectionner une commune</option>
                {COMMUNE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Arrondissement <span className="text-red-500">*</span>
              </label>
              <select
                name="arrondissement"
                value={formData.arrondissement}
                onChange={handleChange}
                required
                disabled={!formData.commune}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Sélectionner</option>
                {formData.commune &&
                  ARRONDISSEMENTS_PAR_COMMUNE[formData.commune]?.map((arr) => (
                    <option key={arr} value={arr}>
                      {arr}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quartier <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="quartier"
                value={formData.quartier}
                onChange={handleChange}
                required
                placeholder="Ex: Zongo, Centre-ville"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Localisation (Détails complémentaires d'adresse)
            </label>
            <input
              type="text"
              name="localisation"
              value={formData.localisation ?? ""}
              onChange={handleChange}
              placeholder="Ex: Carré 402, à côté de la pharmacie Allada"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* SECTION 3: DONNÉES FINANCIÈRES & CALCULS */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Building className="w-4 h-4 text-emerald-600" />
            Éléments d'imposition & Chiffre d'Affaires
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Année de début d'exercice <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="startYear"
                value={formData.startYear ?? 2024}
                onChange={handleChange}
                required
                min={2000}
                max={2099}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Chiffre d'Affaires (Autres activités) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="montantAutresActivites"
                value={formData.montantAutresActivites || ""}
                onChange={handleChange}
                required
                placeholder="Ex: 5000000"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Acomptes Payés <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="acomptesPayes"
                value={formData.acomptesPayes || ""}
                onChange={handleChange}
                required
                placeholder="Ex: 10000"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* RÉSUMÉ DES CALCULS DYNAMIQUES */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                TPS Calculée (5%)
              </span>
              <span className="text-lg font-bold text-slate-800">
                {calculations.tpsCalcule.toLocaleString("fr-FR")} FCFA
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                PORTB (Fixe)
              </span>
              <span className="text-lg font-bold text-slate-800">
                {calculations.portb.toLocaleString("fr-FR")} FCFA
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Impôt Dû (TPS + PORTB)
              </span>
              <span className="text-lg font-bold text-emerald-600">
                {calculations.impotDu.toLocaleString("fr-FR")} FCFA
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Reste à Payer (Reste dû)
              </span>
              <span className="text-lg font-bold text-amber-600">
                {calculations.resteDu.toLocaleString("fr-FR")} FCFA
              </span>
            </div>
          </div>
        </div>

        {/* BOUTON DE SOUMISSION */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-6 py-3 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Enregistrement en cours..." : "Enregistrer la fiche TPS"}
          </button>
        </div>
      </form>
    </div>
  );
};
