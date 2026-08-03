"use client";

import React, { useState, useEffect } from "react";
import { TaxpayerInput } from "@/types/liquidation";
import { User, MapPin, Building, Calendar, RefreshCw, Loader2 } from "lucide-react";
import { fetchValeurAdministrative } from "@/actions/liquidationActions";

const COMMUNE_OPTIONS = [
  { value: "ALLADA", label: "ALLADA" },
  { value: "TOFFO", label: "TOFFO" },
  { value: "TORI-BOSSITO", label: "TORI-BOSSITO" },
  { value: "ZE", label: "ZE (ZÈ)" },
];

interface TaxFormProps {
  formData: TaxpayerInput;
  onChange: (data: TaxpayerInput) => void;
  onReset: () => void;
}

export const TaxForm: React.FC<TaxFormProps> = ({ formData, onChange, onReset }) => {
  const [loadingVa, setLoadingVa] = useState(false);

  // Trigger dynamic loading when commune changes
  useEffect(() => {
    if (!formData.commune) return;

    let active = true;
    const loadVa = async () => {
      setLoadingVa(true);
      try {
        const va = await fetchValeurAdministrative(formData.commune);
        if (active) {
          onChange({
            ...formData,
            valeurLocative: va !== null ? va : "",
          });
        }
      } catch (err) {
        console.error("Erreur lors de la récupération de la VA:", err);
      } finally {
        if (active) setLoadingVa(false);
      }
    };

    loadVa();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.commune]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value, type } = e.target;

    if (name === "ifuNpi") {
      value = value.replace(/\D/g, "");
    }

    if (name === "phone") {
      let digits = value.replace(/\D/g, "");
      if (digits.length > 0 && !digits.startsWith("01")) {
        if (digits.startsWith("0")) {
          digits = "01" + digits.slice(1);
        } else if (digits.startsWith("1")) {
          digits = "01" + digits.slice(1);
        } else {
          digits = "01" + digits;
        }
      }
      value = digits.slice(0, 10);
    }

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

  const isVaReadOnly = formData.valeurLocative !== "" && !loadingVa;

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
                inputMode="numeric"
                value={formData.ifuNpi}
                onChange={handleChange}
                placeholder="Ex: 3201589471203"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
              <input
                type="text"
                name="phone"
                inputMode="numeric"
                maxLength={10}
                value={formData.phone}
                onChange={handleChange}
                placeholder="Ex: 0197000000"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

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
              <select
                name="commune"
                value={formData.commune}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              >
                <option value="" disabled>
                  Sélectionnez une commune
                </option>
                {COMMUNE_OPTIONS.map((commune) => (
                  <option key={commune.value} value={commune.value}>
                    {commune.label}
                  </option>
                ))}
              </select>
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
            <div className="relative">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Valeur Administrative (VA en FCFA) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="valeurLocative"
                  value={formData.valeurLocative}
                  onChange={handleChange}
                  min="0"
                  step="any"
                  placeholder={loadingVa ? "Chargement..." : "Saisissez manuellement"}
                  className={`w-full px-3 py-2 pr-10 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold ${
                    isVaReadOnly
                      ? "border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed select-none"
                      : "border-slate-300 bg-white text-slate-900"
                  }`}
                  readOnly={isVaReadOnly}
                  required
                />
                {loadingVa && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </span>
                )}
              </div>
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
