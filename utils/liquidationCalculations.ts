import { TaxExercise, TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { formatDescriptionBien, formatExonerationMention } from "@/utils/descriptionBien";
import { getTaxRuleForYear } from "@/utils/taxRules";

const P_ORTB_MONTANT = 4000; // Forfait fixe P-ORTB en FCFA

export function buildLiquidationCalculations(formData: TaxpayerInput): LiquidationCalculations {
  const isBati = formData.typeBien === "BATI";

  // ── FONCIER NON BÂTI (FNB) ───────────────────────────────────────────────
  if (!isBati) {
    return buildFnbCalculations(formData);
  }

  // ── FONCIER BÂTI (FB) ───────────────────────────────────────────────────
  return buildFbCalculations(formData);
}

/** Calculs FNB : 4 exercices consécutifs sur superficie × valeur administrative */
function buildFnbCalculations(formData: TaxpayerInput): LiquidationCalculations {
  const surfaceTotale = typeof formData.superficie === "number" ? formData.superficie : 0;
  const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;

  const surfaceImposable =
    typeof formData.superficieImposable === "number" && formData.superficieImposable > 0
      ? formData.superficieImposable
      : surfaceTotale;

  const adresseDescription = formatDescriptionBien({
    superficie: surfaceTotale,
    commune: formData.commune,
    arrondissement: formData.arrondissement,
    quartier: formData.quartier,
  });

  const exonerationMention = formatExonerationMention({
    superficie: surfaceTotale,
    superficieImposable: surfaceImposable,
  });

  const baseImposable = surfaceImposable * valeurLocative;
  const exercises: TaxExercise[] = [];
  let totalDu = 0;
  const startYear =
    typeof formData.startYear === "number" && formData.startYear > 1900
      ? formData.startYear
      : 2023;

  for (let i = 0; i < 4; i++) {
    const year = startYear + i;
    const taxRule = getTaxRuleForYear(year, formData.typeBien);
    const droitSimple = baseImposable * taxRule.taux;
    totalDu += droitSimple;
    exercises.push({
      year,
      taxNature: taxRule.natureImpot,
      description: adresseDescription,
      baseImposable,
      taux: taxRule.taux,
      droitSimple,
    });
  }

  return {
    surfaceTotale,
    surfaceImposable,
    surf: surfaceImposable,
    valeurLocative,
    adresseDescription,
    exonerationMention,
    exercises,
    totalDu,
  };
}

/** Calculs FB : 1 ou 3 articles selon is_loue */
function buildFbCalculations(formData: TaxpayerInput): LiquidationCalculations {
  const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;
  const startYear =
    typeof formData.startYear === "number" && formData.startYear > 1900
      ? formData.startYear
      : new Date().getFullYear();

  const commune = (formData.commune || "").toUpperCase();
  const arrondissement = (formData.arrondissement || "").toUpperCase();
  const quartier = (formData.quartier || "").toUpperCase();
  const locationStr = [commune, arrondissement, quartier].filter(Boolean).join("/");
  const adresseDescription = locationStr || "LOCALISATION NON RENSEIGNEE";

  const exercises: TaxExercise[] = [];
  let totalDu = 0;

  if (formData.isLoue) {
    // ── FB EN LOCATION : IRF + P-ORTB + TFU/FB ────────────────────────────
    const valeurIrf = typeof formData.valeurIrf === "number" ? formData.valeurIrf : 0;

    // Article 1 : IRF — exercice = startYear - 1
    const irfDroit = valeurIrf * 0.12;
    totalDu += irfDroit;
    exercises.push({
      year: startYear - 1,
      taxNature: "IRF",
      description: "MICRO FONCIER - " + adresseDescription,
      baseImposable: valeurIrf,
      taux: 0.12,
      droitSimple: irfDroit,
    });

    // Article 2 : P-ORTB — forfait fixe
    totalDu += P_ORTB_MONTANT;
    exercises.push({
      year: startYear,
      taxNature: "P-ORTB",
      description: "PRELEVEMENT ORTB - " + adresseDescription,
      baseImposable: 0,
      taux: 0,
      droitSimple: P_ORTB_MONTANT,
    });

    // Article 3 : TFU/FB — valeur locative × 6%
    const tfuDroit = valeurLocative * 0.06;
    totalDu += tfuDroit;
    exercises.push({
      year: startYear,
      taxNature: "TFU/FB",
      description: formData.description || "PROPRIETE SISE A " + adresseDescription,
      baseImposable: valeurLocative,
      taux: 0.06,
      droitSimple: tfuDroit,
    });
  } else {
    // ── FB SANS LOCATION : TFU/FB uniquement ──────────────────────────────
    const tfuDroit = valeurLocative * 0.06;
    totalDu = tfuDroit;
    exercises.push({
      year: startYear,
      taxNature: "TFU/FB",
      description: formData.description || "PROPRIETE SISE A " + adresseDescription,
      baseImposable: valeurLocative,
      taux: 0.06,
      droitSimple: tfuDroit,
    });
  }

  return {
    surfaceTotale: 0,
    surfaceImposable: 0,
    surf: 0,
    valeurLocative,
    adresseDescription,
    exercises,
    totalDu,
  };
}
