/**
 * utils/descriptionBien.ts
 *
 * SOURCE UNIQUE DE VERITE pour la description textuelle d'une parcelle.
 * Utilisee par :
 *   - liquidationCalculations.ts  (previsualisation cote formulaire)
 *   - avisPdfGenerator.ts         (fallback si l'article Supabase n'a pas de description)
 *
 * Convention de nommage :
 *   - TypeScript : superficieImposable
 *   - Base de donnees : superficie_imposable
 */

export interface DescriptionBienParams {
  /** Superficie totale reelle de la parcelle (m²) */
  superficie: number;
  /**
   * Superficie imposable (m²).
   * Si definie et differente de superficie, cela permet d'afficher une mention d'exoneration a part.
   */
  superficieImposable?: number | null;
  commune?: string;
  arrondissement?: string;
  quartier?: string;
}

export interface ExonerationParams {
  superficie: number;
  superficieImposable?: number | null;
}

/**
 * Formate la description officielle d'une parcelle.
 *
 * Exemples :
 *  - Sans exoneration : "PARCELLE DE 500 M² SISE A ALLADA/ALLADA/CADJEHOUN"
 *  - Avec exoneration : "PARCELLE DE 500 M² SISE A ALLADA/ALLADA/CADJEHOUN"
 */
export function formatDescriptionBien({
  superficie,
  commune,
  arrondissement,
  quartier,
}: DescriptionBienParams): string {
  const communeStr = (commune ?? "").trim().toUpperCase();
  const arrStr = (arrondissement ?? "").trim().toUpperCase();
  const quartStr = (quartier ?? "").trim().toUpperCase();

  const locationStr = [communeStr, arrStr, quartStr].filter(Boolean).join("/");

  return locationStr
    ? `PARCELLE DE ${superficie} M² SISE A ${locationStr}`
    : `PARCELLE DE ${superficie} M²`;
}

/**
 * Retourne la mention d'exoneration a afficher a part dans le document.
 */
export function formatExonerationMention({ superficie, superficieImposable }: ExonerationParams): string {
  const hasExoneration =
    typeof superficieImposable === "number" &&
    Number.isFinite(superficieImposable) &&
    superficieImposable > 0 &&
    superficieImposable < superficie;

  return hasExoneration
    ? `AVEC EXONERATION PARTIELLE : SUPERFICIE IMPOSABLE ${superficieImposable} M²`
    : "";
}
