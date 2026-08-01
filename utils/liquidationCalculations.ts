import { TaxExercise, TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";

export function buildLiquidationCalculations(formData: TaxpayerInput): LiquidationCalculations {
  const surf = typeof formData.superficie === "number" ? formData.superficie : 0;
  const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;
  const communeStr = formData.commune ? formData.commune.toUpperCase() : "";
  const arrStr = formData.arrondissement ? formData.arrondissement.toUpperCase() : "";
  const quartStr = formData.quartier ? formData.quartier.toUpperCase() : "";
  const locationStr = [communeStr, arrStr, quartStr].filter(Boolean).join("/");
  const adresseDescription = locationStr
    ? `PARCELLE DE ${surf} m2 SISE A ${locationStr}`
    : `PARCELLE DE ${surf} m2`;
  const baseImposable = surf * valeurLocative;
  const exercises: TaxExercise[] = [];
  let totalDu = 0;
  const startYear = typeof formData.startYear === "number" && formData.startYear > 1900 ? formData.startYear : 2023;

  for (let i = 0; i < 4; i++) {
    const year = startYear + i;
    const taux = i === 0 ? 0.04 : 0.05;
    const droitSimple = baseImposable * taux;
    totalDu += droitSimple;
    exercises.push({ year, taxNature: "TFU/FNB", description: adresseDescription, baseImposable, taux, droitSimple });
  }

  return { surf, valeurLocative, adresseDescription, exercises, totalDu };
}