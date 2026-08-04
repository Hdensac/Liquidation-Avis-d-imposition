import { TaxExercise, TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { formatDescriptionBien } from "@/utils/descriptionBien";

export function buildLiquidationCalculations(formData: TaxpayerInput): LiquidationCalculations {
  const surf = typeof formData.superficie === "number" ? formData.superficie : 0;
  const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;

  // Superficie utilisée pour le calcul de la base imposable :
  // si une exonération est définie, on l'utilise ; sinon, on utilise la superficie totale.
  const superficieImposable =
    typeof formData.superficieImposable === "number" && formData.superficieImposable > 0
      ? formData.superficieImposable
      : surf;

  // Description centralisée via la source unique de vérité
  const adresseDescription = formatDescriptionBien({
    superficie: surf,
    superficieImposable: superficieImposable !== surf ? superficieImposable : null,
    commune: formData.commune,
    arrondissement: formData.arrondissement,
    quartier: formData.quartier,
  });

  const baseImposable = superficieImposable * valeurLocative;
  const exercises: TaxExercise[] = [];
  let totalDu = 0;
  const startYear =
    typeof formData.startYear === "number" && formData.startYear > 1900
      ? formData.startYear
      : 2023;

  for (let i = 0; i < 4; i++) {
    const year = startYear + i;
    const taux = i === 0 ? 0.04 : 0.05;
    const droitSimple = baseImposable * taux;
    totalDu += droitSimple;
    exercises.push({
      year,
      taxNature: "TFU/FNB",
      description: adresseDescription,
      baseImposable,
      taux,
      droitSimple,
    });
  }

  return { surf: superficieImposable, valeurLocative, adresseDescription, exercises, totalDu };
}