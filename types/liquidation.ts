export type TaxPropertyType = "NON_BATI" | "BATI";

export interface TaxpayerInput {
  // Infos Contribuable
  fullname: string;
  ifuNpi: string;
  phone: string;

  // Localisation
  commune: string;
  arrondissement: string;
  quartier: string;

  // Caracteristiques
  typeBien: TaxPropertyType;
  superficie: number | "";
  /**
   * Superficie reellement imposable (m2).
   * Definie uniquement en cas d exoneration partielle (ex : zone cultivee).
   * Les calculs utilisent cette valeur a la place de superficie.
   * Convention BDD : superficie_imposable (NULL si pas d exoneration).
   */
  superficieImposable?: number | "";
  valeurLocative: number | "";

  // Annee de depart pour les 4 exercices (FNB) ou exercice principal (FB)
  startYear: number;

  // Foncier Bati (FB)
  /** Indique si le bien est mis en location (declenche le calcul IRF + P-ORTB) */
  isLoue?: boolean;
  /** Base imposable Micro Foncier (IRF = valeurIrf x 12%). Requis si isLoue = true */
  valeurIrf?: number | "";
  /** Description libre du batiment pour l article TFU/FB (ex: "1bat de 1p x 6") */
  description?: string;
}

export interface TaxExercise {
  year: number;
  taxNature: string;
  description: string;
  baseImposable: number;
  taux: number;
  droitSimple: number;
}

export interface LiquidationCalculations {
  surfaceTotale: number;
  surfaceImposable: number;
  surf: number;
  valeurLocative: number;
  adresseDescription: string;
  exonerationMention?: string;
  exercises: TaxExercise[];
  totalDu: number;
}
