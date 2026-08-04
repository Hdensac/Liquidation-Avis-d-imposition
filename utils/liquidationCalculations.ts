import { TaxExercise, TaxpayerInput, LiquidationCalculations } from "@/types/liquidation";
import { formatDescriptionBien, formatExonerationMention } from "@/utils/descriptionBien";

export function buildLiquidationCalculations(formData: TaxpayerInput): LiquidationCalculations {
  const surfaceTotale = typeof formData.superficie === "number" ? formData.superficie : 0;
  const valeurLocative = typeof formData.valeurLocative === "number" ? formData.valeurLocative : 0;

  // Superficie utilisee pour le calcul de la base imposable :
  // si une exoneration est definie, on l'utilise ; sinon, on utilise la superficie totale.
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

