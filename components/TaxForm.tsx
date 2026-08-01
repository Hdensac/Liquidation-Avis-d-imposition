"use client";

import React from "react";
import { TaxpayerInput } from "@/types/liquidation";
import { User, MapPin, Building, Calendar, RefreshCw } from "lucide-react";

interface TaxFormProps {
  formData: TaxpayerInput;
  onChange: (data: TaxpayerInput) => void;
  onReset: () => void;
}

export const TaxForm: React.FC<TaxFormProps> = ({ formData, onChange, onReset }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === "number") {
      const numValue = value === "" ? "" : parseFloat(value);
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

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Paramètres de Liquidation
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Remplissez les informations pour générer automatiquement l'avis de mise en recouvrement.
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

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* Section 1 : Infos Contribuable */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-600" />
            Informations du Contribuable
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nom & Prénoms <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="fullname"
                value={formData.fullname}
                onChange={handleChange}
                placeholder="Ex: KPANOU Jean"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                N° IFU / NPI <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="ifuNpi"
                value={formData.ifuNpi}
                onChange={handleChange}
                placeholder="Ex: 3201589471203"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Téléphone
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ex: +229 97 00 00 00"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Section 2 : Localisation */}
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            Localisation du Bien
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Commune <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="commune"
                value={formData.commune}
                onChange={handleChange}
                placeholder="Ex: COTONOU"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Arrondissement <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="arrondissement"
                value={formData.arrondissement}
                onChange={handleChange}
                placeholder="Ex: 12ème ARRONDISSEMENT"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
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
                placeholder="Ex: CADJEHOUN"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 3 : Caractéristiques & Année */}
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            Caractéristiques Imposables & Période
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Superficie (m²) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="superficie"
                value={formData.superficie}
                onChange={handleChange}
                min="1"
                step="any"
                placeholder="Ex: 500"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Valeur Administraive  (VA en FCFA) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="valeurLocative"
                value={formData.valeurLocative}
                onChange={handleChange}
                min="0"
                step="any"
                placeholder="Ex: 1500"
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-100 text-slate-500 rounded-lg cursor-not-allowed outline-none select-none font-semibold"
                readOnly
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Année de début (4 Exercices)
              </label>
              <input
                type="number"
                name="startYear"
                value={formData.startYear}
                onChange={handleChange}
                min="2000"
                max="2100"
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-100 text-slate-500 rounded-lg cursor-not-allowed outline-none select-none"
                readOnly
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
