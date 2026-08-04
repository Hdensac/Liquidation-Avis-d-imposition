export interface TaxpayerInput {
  // Infos Contribuable
  fullname: string;
  ifuNpi: string;
  phone: string;
  
  // Localisation
  commune: string;
  arrondissement: string;
  quartier: string;
  
  // Caractéristiques
  superficie: number | "";
  /**
   * Superficie réellement imposable (m²).
   * Définie uniquement en cas d'exonération partielle (ex : zone cultivée).
   * Les calculs utilisent cette valeur à la place de `superficie`.
   * Convention BDD : superficie_imposable (NULL si pas d'exonération).
   */
  superficieImposable?: number | "";
  valeurLocative: number | "";
  
  // Année de départ pour les 4 exercices
  startYear: number;
}

export interface TaxExercise {
  year: number;
  taxNature: string; // "TFU/FNB"
  description: string;
  baseImposable: number; // SURF * VA
  taux: number; // 0.04 (4%) pour année 1, 0.05 (5%) pour années 2, 3, 4
  droitSimple: number; // Base * Taux
}

export interface LiquidationCalculations {
  surf: number;
  valeurLocative: number;
  adresseDescription: string;
  exercises: TaxExercise[];
  totalDu: number;
}
