"use client";

import React, { useState, useEffect, useRef } from "react";
import { TaxpayerInput } from "@/types/liquidation";
import { User, MapPin, Building, Calendar, RefreshCw, Loader2, Home, CheckCircle2 } from "lucide-react";
import { fetchValeurAdministrative } from "@/actions/liquidationActions";
import { lookupTaxpayerByIdentifier } from "@/actions/taxpayerActions";

export const COMMUNE_OPTIONS = [
  { value: "ALLADA", label: "ALLADA" },
  { value: "TOFFO", label: "TOFFO" },
  { value: "TORI-BOSSITO", label: "TORI-BOSSITO" },
  { value: "ZE", label: "ZE (ZÈ)" },
];

/**
 * Mapping statique des arrondissements par commune.
 * Clés alignées sur les valeurs de COMMUNE_OPTIONS (trait d'union pour TORI-BOSSITO).
 */
export const ARRONDISSEMENTS_PAR_COMMUNE: Record<string, string[]> = {
  ALLADA: [
    "Agbanou",
    "Ahouannonzoun",
    "Allada",
    "Attogon",
    "Avakpa",
    "Ayou",
    "Hinvi",
    "Lissègazoun",
    "Lon-Agonmey",
    "Tokpa",
    "Sékou",
    "Togoudo",
  ],
  "TORI-BOSSITO": [
    "Avamè",
    "Azohouè-Aliho",
    "Azohouè-Cada",
    "Tori-Bossito",
    "Tori-Cada",
    "Tori-Gare",
  ],
  ZE: [
    "Adjan",
    "Dawè",
    "Djigbé",
    "Dodji-Bata",
    "Hékanmè",
    "Koundokpoé",
    "Sèdjè-Dénou",
    "Sèdjè-Houégoudo",
    "Tangbo-Djèvié",
    "Yokpo",
    "Zè",
  ],
  TOFFO: [
    "Agbame",
    "Ahlan",
    "Colli-Agbase",
    "Coussi",
    "Damè",
    "Djanglanmè",
    "Houégbo",
    "Kpoba",
    "Sè",
    "Toffo-Agué",
  ],
};

/** Helper pour obtenir la liste des arrondissements d'une commune quelle que soit sa casse/accents */
export function getArrondissementsForCommune(commune?: string): string[] {
  if (!commune) return [];
  const normCommune = commune.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const foundKey = Object.keys(ARRONDISSEMENTS_PAR_COMMUNE).find(
    (key) => key.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normCommune
  );
  return foundKey ? ARRONDISSEMENTS_PAR_COMMUNE[foundKey] : [];
}

/** Helper pour trouver l'arrondissement correspondant (gestion majuscules/accents enregistrés en BD) */
export function findMatchingArrondissement(commune?: string, arrondissement?: string): string {
  if (!arrondissement) return "";
  const list = getArrondissementsForCommune(commune);
  if (list.includes(arrondissement)) return arrondissement;

  const normalizeStr = (s: string) =>
    s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const normTarget = normalizeStr(arrondissement);
  const match = list.find((item) => normalizeStr(item) === normTarget);
  return match ?? arrondissement;
}

/** Années disponibles pour l'exercice principal FB */
function getExerciceOptions(): { value: number; label: string }[] {
  const current = new Date().getFullYear();
  return [
    { value: current,     label: `Année en cours (${current})` },
    { value: current - 1, label: ` (${current - 1})` },
    { value: current - 2, label: ` (${current - 2})` },
    { value: current - 3, label: ` (${current - 3})` },
  ];
}

interface TaxFormProps {
  formData: TaxpayerInput;
  onChange: (data: TaxpayerInput) => void;
  onReset: () => void;
  canApplyExoneration?: boolean;
}

export const TaxForm: React.FC<TaxFormProps> = ({
  formData,
  onChange,
  onReset,
  canApplyExoneration = false,
}) => {
  const [loadingVa, setLoadingVa] = useState(false);
  const [hasExoneration, setHasExoneration] = useState(false);
  const [isSearchingTaxpayer, setIsSearchingTaxpayer] = useState(false);
  const [foundNotice, setFoundNotice] = useState<string | null>(null);

  const lastLookedUpRef = useRef<string>("");

  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const executeTaxpayerLookup = async (rawIfu: string) => {
    const clean = rawIfu.replace(/\D/g, "");
    if (clean.length < 8 || clean === lastLookedUpRef.current) return;

    lastLookedUpRef.current = clean;
    setIsSearchingTaxpayer(true);
    try {
      const res = await lookupTaxpayerByIdentifier(clean);
      if (res && res.fullname) {
        onChange({
          ...formDataRef.current,
          ifuNpi: res.ifuNpi || clean,
          fullname: res.fullname,
          phone: res.phone || formDataRef.current.phone,
        });
        setFoundNotice(`Contribuable existant trouvé (${res.source}) : ${res.fullname}`);
      } else {
        setFoundNotice(null);
      }
    } catch (err) {
      console.error("Erreur lors de la recherche du contribuable:", err);
    } finally {
      setIsSearchingTaxpayer(false);
    }
  };

  useEffect(() => {
    const clean = formData.ifuNpi.replace(/\D/g, "");
    if (clean.length < 8) {
      setFoundNotice(null);
      lastLookedUpRef.current = "";
      return;
    }

    // Déclenchement instantané à 13 chiffres
    if (clean.length === 13) {
      executeTaxpayerLookup(clean);
      return;
    }

    // Debounce de 2 secondes
    const timer = setTimeout(() => {
      executeTaxpayerLookup(clean);
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData.ifuNpi]);

  const isBati = formData.typeBien === "BATI";
  const superficieTotale =
    typeof formData.superficie === "number" ? formData.superficie : 0;

  useEffect(() => {
    if (!canApplyExoneration && hasExoneration) {
      setHasExoneration(false);
    }
  }, [canApplyExoneration, hasExoneration]);

  // Quand on change de commune (FNB) → charger la VA
  useEffect(() => {
    if (!formData.commune || isBati) return;

    let active = true;
    const loadVa = async () => {
      setLoadingVa(true);
      try {
        const va = await fetchValeurAdministrative(formData.commune);
        if (active) {
          onChange({
            ...formData,
            arrondissement: "",
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
      onChange({ ...formData, [name]: numValue });
    } else {
      onChange({ ...formData, [name]: value });
    }
  };

  /** Quand on bascule le type de bien : réinitialiser les champs spécifiques */
  const handleTypeBienChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as "NON_BATI" | "BATI";
    const currentYear = new Date().getFullYear();
    onChange({
      ...formData,
      typeBien: newType,
      // Réinitialiser les champs spécifiques à chaque type
      superficie: "",
      superficieImposable: "",
      valeurLocative: "",
      startYear: newType === "BATI" ? currentYear : 2023,
      isLoue: false,
      valeurIrf: "",
      description: "",
    });
    setHasExoneration(false);
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
          onClick={() => {
            setHasExoneration(false);
            onReset();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
          title="Réinitialiser les données"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Réinitialiser
        </button>
      </div>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {/* ── SECTION : Contribuable ─────────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <User className="w-4 h-4 text-blue-600" />
            Informations du Contribuable
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                N° IFU / NPI <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="ifuNpi"
                  inputMode="numeric"
                  value={formData.ifuNpi}
                  onChange={handleChange}
                  onBlur={() => {
                    const clean = formData.ifuNpi.replace(/\D/g, "");
                    if (clean.length >= 8) {
                      executeTaxpayerLookup(clean);
                    }
                  }}
                  placeholder="Ex: 3201589471203"
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
                {isSearchingTaxpayer && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              {foundNotice && (
                <div className="mt-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 flex items-center gap-1.5 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{foundNotice}</span>
                </div>
              )}
            </div>
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

        {/* ── SECTION : Localisation ─────────────────────────────────────── */}
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
                <option value="" disabled>Sélectionnez une commune</option>
                {COMMUNE_OPTIONS.map((commune) => (
                  <option key={commune.value} value={commune.value}>{commune.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Arrondissement <span className="text-red-500">*</span>
              </label>
              <select
                name="arrondissement"
                value={findMatchingArrondissement(formData.commune, formData.arrondissement)}
                onChange={handleChange}
                disabled={!formData.commune}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                required
              >
                <option value="" disabled>
                  {formData.commune ? "Sélectionnez un arrondissement" : "Sélectionnez d'abord une commune"}
                </option>
                {getArrondissementsForCommune(formData.commune).map((arr) => (
                  <option key={arr} value={arr}>{arr}</option>
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
                placeholder="Ex: CADJEHOUN"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>
        </div>

        {/* ── SECTION : Caractéristiques Imposables & Période ───────────── */}
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            Caractéristiques Imposables & Période
          </h3>

          {/* Sélecteur type de bien */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Type de bien <span className="text-red-500">*</span>
              </label>
              <select
                name="typeBien"
                value={formData.typeBien}
                onChange={handleTypeBienChange}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
              >
                <option value="NON_BATI">Foncier Non Bâti / FNB</option>
                <option value="BATI">Foncier Bâti / FB</option>
              </select>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* CHAMPS FNB                                                      */}
          {/* ─────────────────────────────────────────────────────────────── */}
          {!isBati && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Superficie totale + switch exonération */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Superficie totale (m²) <span className="text-red-500">*</span>
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
                {canApplyExoneration && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hasExoneration}
                    onClick={() => {
                      const next = !hasExoneration;
                      setHasExoneration(next);
                      if (!next) onChange({ ...formData, superficieImposable: "" });
                    }}
                    className={`inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-md border transition-colors ${
                      hasExoneration
                        ? "bg-amber-50 border-amber-400 text-amber-700"
                        : "bg-slate-50 border-slate-300 text-slate-500 hover:border-slate-400"
                    }`}
                  >
                    <span className={`inline-block w-7 h-4 rounded-full transition-colors relative ${hasExoneration ? "bg-amber-400" : "bg-slate-300"}`}>
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${hasExoneration ? "translate-x-3" : "translate-x-0"}`} />
                    </span>
                    Exoneration partielle
                  </button>
                )}

                {canApplyExoneration && hasExoneration && (
                  <div>
                    <label className="block text-xs font-medium text-amber-700 mb-1">
                      Superficie imposable (m²) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="superficieImposable"
                      value={formData.superficieImposable ?? ""}
                      onChange={handleChange}
                      min="1"
                      max={superficieTotale > 0 ? superficieTotale - 1 : undefined}
                      step="any"
                      placeholder={`< ${superficieTotale || "superficie totale"} m²`}
                      className="w-full px-3 py-2 text-sm border border-amber-400 bg-amber-50 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all font-semibold text-amber-900"
                      required
                    />
                    {typeof formData.superficieImposable === "number" &&
                      superficieTotale > 0 &&
                      formData.superficieImposable >= superficieTotale && (
                        <p className="text-xs text-red-600 mt-1">
                          Doit être inférieure à la superficie totale ({superficieTotale} m²)
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* Valeur Administrative (auto-chargée) */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Valeur Administrative (VA en FCFA) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="valeurLocative"
                    value={formData.valeurLocative}
                    min="0"
                    step="any"
                    placeholder={loadingVa ? "Chargement..." : "Sélectionnez une commune"}
                    className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 bg-slate-100 text-slate-600 rounded-lg outline-none transition-all font-semibold cursor-not-allowed select-none"
                    readOnly
                    required
                  />
                  {loadingVa && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </span>
                  )}
                </div>
              </div>

              {/* Année de début */}
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
          )}

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* CHAMPS FB                                                       */}
          {/* ─────────────────────────────────────────────────────────────── */}
          {isBati && (
            <div className="space-y-4">
              {/* Ligne 1 : Exercice Principal + Valeur Locative (VL) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Exercice <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="startYear"
                    value={formData.startYear}
                    onChange={handleChange}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                    required
                  >
                    {getExerciceOptions().map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Valeur Locative / VL (FCFA) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="valeurLocative"
                    value={formData.valeurLocative}
                    onChange={handleChange}
                    min="0"
                    step="any"
                    placeholder="Ex: 720 000"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Description du bâti */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description du bâtiment (pour TFU/FB)
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description ?? ""}
                  onChange={handleChange}
                  placeholder="Ex: 1BAT DE 1P X 6 SISE A ALLADA/ALLADA/CADJEHOUN"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* Option En Location */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  id="isLoue"
                  name="isLoue"
                  checked={formData.isLoue ?? false}
                  onChange={(e) => {
                    onChange({
                      ...formData,
                      isLoue: e.target.checked,
                      valeurIrf: e.target.checked ? formData.valeurIrf : "",
                    });
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="isLoue" className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2">
                  <Home className="w-4 h-4 text-slate-500" />
                  Batiment en location
                  <span className="text-xs font-normal text-slate-400">(déclenche IRF Micro Foncier + P-ORTB)</span>
                </label>
              </div>

              {/* Champ conditionnel : Valeur IRF */}
              {formData.isLoue && (
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    Données Micro Foncier (IRF)
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-blue-800 mb-1">
                      Valeur IRF — Base Micro Foncier (FCFA) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="valeurIrf"
                      value={formData.valeurIrf ?? ""}
                      onChange={handleChange}
                      min="0"
                      step="any"
                      placeholder="Ex: 216 000"
                      className="w-full px-3 py-2 text-sm border border-blue-300 bg-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-semibold"
                      required
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      IRF = Valeur IRF × 12% — Exercice : {formData.startYear - 1}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};