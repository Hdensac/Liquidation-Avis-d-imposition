import { z } from "zod";

// Validateur pour les nombres qui peuvent être une chaîne vide
const numericOrEmpty = z.union([
  z.number().min(0, "La valeur doit être positive ou nulle"),
  z.literal(""),
  z.null(),
  z.undefined()
]);

export const taxpayerInputSchema = z.object({
  fullname: z.string().trim().min(1, "Le nom complet est obligatoire").max(255),
  ifuNpi: z.string().trim().min(1, "Le numéro IFU/NPI est obligatoire").max(50),
  phone: z.string().trim().max(50).default(""),
  commune: z.string().trim().min(1, "La commune est obligatoire").max(100),
  arrondissement: z.string().trim().min(1, "L'arrondissement est obligatoire").max(100),
  quartier: z.string().trim().min(1, "Le quartier est obligatoire").max(100),
  typeBien: z.enum(["NON_BATI", "BATI"]),
  superficie: z.union([z.number().min(0), z.literal("")]),
  superficieImposable: numericOrEmpty,
  valeurLocative: z.union([z.number().min(0), z.literal("")]),
  startYear: z.number().int().min(1900).max(2100),
  isLoue: z.boolean().optional(),
  valeurIrf: numericOrEmpty,
  description: z.string().trim().max(1000).optional(),
});

export const tpsInputSchema = z.object({
  nomRaisonSociale: z.string().trim().min(1, "Le nom ou raison sociale est obligatoire").max(255),
  ifuNc: z.string().trim().min(1, "Le numéro IFU/NC est obligatoire").max(50),
  telephone: z.string().trim().max(50).optional().nullable(),
  commune: z.string().trim().min(1, "La commune est obligatoire").max(100),
  arrondissement: z.string().trim().min(1, "L'arrondissement est obligatoire").max(100),
  quartier: z.string().trim().min(1, "Le quartier est obligatoire").max(100),
  localisation: z.string().trim().max(255).optional().nullable(),
  activite: z.string().trim().min(1, "L'activité est obligatoire").max(255),
  montantAutresActivites: z.number().min(0),
  acomptesPayes: z.number().min(0),
  startYear: z.number().int().min(1900).max(2100).optional(),
});
