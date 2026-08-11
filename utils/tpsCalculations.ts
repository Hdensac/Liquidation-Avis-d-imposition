export interface TpsInput {
  nomRaisonSociale: string;
  ifuNc: string;
  telephone?: string;
  commune: string;
  arrondissement: string;
  quartier: string;
  localisation?: string;
  activite: string;
  montantAutresActivites: number;
  acomptesPayes: number;
  startYear?: number;
}

export interface TpsCalculations {
  tpsCalcule: number;
  portb: number;
  impotDu: number;
  resteDu: number;
  startYear: number;
}

export function buildTpsCalculations(input: {
  montantAutresActivites: number;
  acomptesPayes: number;
  startYear?: number;
}): TpsCalculations {
  const montantAutresActivites = Number(input.montantAutresActivites) || 0;
  const acomptesPayes = Number(input.acomptesPayes) || 0;
  const startYear = Number(input.startYear) || 2024;

  const tpsCalcule = Math.round(montantAutresActivites * 0.05);
  const portb = 4000;
  const impotDu = tpsCalcule + portb;
  const resteDu = impotDu - acomptesPayes;

  return {
    tpsCalcule,
    portb,
    impotDu,
    resteDu,
    startYear,
  };
}
