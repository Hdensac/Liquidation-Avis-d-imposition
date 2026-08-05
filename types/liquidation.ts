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
   * Superficie reellement imposable (m²).
   * Definie uniquement en cas d'exoneration partielle (ex : zone cultivee).
   * Les calculs utilisent cette valeur a la place de `superficie`.
   * Convention BDD : superficie_imposable (NULL si pas d'exoneration).
   */
  superficieImposable?: number | "";
  valeurLocative: number | "";

  // Annee de depart pour les 4 exercices
  startYear: number;
}

export interface TaxExercise {
  year: number;
  taxNature: string;
  description: string;
  baseImposable: number; // SURF * VA
  taux: number;
  droitSimple: number; // Base * Taux
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
