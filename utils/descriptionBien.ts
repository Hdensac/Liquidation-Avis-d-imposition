/**
 * utils/descriptionBien.ts
 *
 * SOURCE UNIQUE DE VÉRITÉ pour la description textuelle d'une parcelle.
 * Utilisée par :
 *   - liquidationCalculations.ts  (prévisualisation côté formulaire)
 *   - avisPdfGenerator.ts         (fallback si l'article Supabase n'a pas de description)
 *
 * Convention de nommage :
 *   - TypeScript : superficieImposable
 *   - Base de données : superficie_imposable
 */

export interface DescriptionBienParams {
  /** Superficie totale réelle de la parcelle (m²) */
  superficie: number;
  /**
   * Superficie imposable (m²).
   * Si définie et différente de superficie, déclenche la mention d'exonération.
   */
  superficieImposable?: number | null;
  commune?: string;
  arrondissement?: string;
  quartier?: string;
}

/**
 * Formate la description officielle d'une parcelle.
 *
 * Exemples :
 *  - Sans exonération : "PARCELLE DE 500 M² SISE A ALLADA/ALLADA/CADJEHOUN"
 *  - Avec exonération : "PARCELLE DE 500 M² SISE A ALLADA/ALLADA/CADJEHOUN (AVEC EXONÉRATION : SUPERFICIE IMPOSABLE 150 M²)"
 */
export function formatDescriptionBien({
  superficie,
  superficieImposable,
  commune,
  arrondissement,
  quartier,
}: DescriptionBienParams): string {
  const communeStr = (commune ?? "").trim().toUpperCase();
  const arrStr = (arrondissement ?? "").trim().toUpperCase();
  const quartStr = (quartier ?? "").trim().toUpperCase();

  const locationStr = [communeStr, arrStr, quartStr].filter(Boolean).join("/");

  const basePart = locationStr
    ? `PARCELLE DE ${superficie} M² SISE A ${locationStr}`
    : `PARCELLE DE ${superficie} M²`;

  const hasExoneration =
    typeof superficieImposable === "number" &&
    Number.isFinite(superficieImposable) &&
    superficieImposable > 0 &&
    superficieImposable < superficie;

  return hasExoneration
    ? `${basePart} AVEC EXONÉRATION PARTIELLE (${superficieImposable} M²)`
    : basePart;
}
