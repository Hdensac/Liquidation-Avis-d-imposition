/**
 * utils/numberToFrenchWords.ts
 * Convertit un nombre entier en toutes lettres en français.
 * Gère : unités, dizaines, centaines, milliers, millions (suffisant pour les montants FCFA).
 * Exemples:
 *   1 500 000 → "un million cinq cent mille francs CFA"
 *   2 847 350 → "deux millions huit cent quarante-sept mille trois cent cinquante francs CFA"
 */

const UNITES = [
  "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];

const DIZAINES = [
  "", "", "vingt", "trente", "quarante", "cinquante",
  "soixante", "soixante", "quatre-vingt", "quatre-vingt",
];

function centToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return UNITES[n];

  const dizaine = Math.floor(n / 10);
  const unite = n % 10;

  // Cas spéciaux : 70-79 et 90-99 (vigesimal)
  if (dizaine === 7 || dizaine === 9) {
    const base = DIZAINES[dizaine];
    const sub = UNITES[10 + unite];
    return unite === 0
      ? (dizaine === 9 ? "quatre-vingt-dix" : "soixante-dix")
      : `${base}-${sub}`;
  }

  // 80 = quatre-vingts (sans "s" si suivi d'un autre nombre)
  if (dizaine === 8) {
    if (unite === 0) return "quatre-vingts";
    return `quatre-vingt-${UNITES[unite]}`;
  }

  // Règle du "et" : 21, 31, 41, 51, 61
  const lien = unite === 1 && dizaine !== 8 ? "-et-" : (unite === 0 ? "" : "-");
  const unitePart = unite === 0 ? "" : UNITES[unite];
  return `${DIZAINES[dizaine]}${lien}${unitePart}`;
}

function centaineToWords(n: number): string {
  if (n < 100) return centToWords(n);

  const centaines = Math.floor(n / 100);
  const reste = n % 100;

  if (centaines === 1) {
    return reste === 0 ? "cent" : `cent ${centToWords(reste)}`;
  }

  // "cents" prend un "s" uniquement si multiple exact de 100
  const centMot = `${UNITES[centaines]} cent`;
  if (reste === 0) return `${centMot}s`;
  return `${centMot} ${centToWords(reste)}`;
}

/**
 * Convertit un montant entier en texte français.
 * @param amount  Montant entier (en FCFA)
 * @returns Montant en toutes lettres + " francs CFA"
 */
export function numberToFrenchWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "montant invalide";

  const n = Math.round(amount);

  if (n === 0) return "zéro franc CFA";

  const parts: string[] = [];

  // Milliards (peu probable pour TFU mais on gère quand même)
  const milliards = Math.floor(n / 1_000_000_000);
  const resteMilliards = n % 1_000_000_000;
  if (milliards > 0) {
    const mot = milliards === 1 ? "un milliard" : `${centaineToWords(milliards)} milliards`;
    parts.push(mot);
  }

  // Millions
  const millions = Math.floor(resteMilliards / 1_000_000);
  const resteMillions = resteMilliards % 1_000_000;
  if (millions > 0) {
    const mot = millions === 1 ? "un million" : `${centaineToWords(millions)} millions`;
    parts.push(mot);
  }

  // Milliers
  const milliers = Math.floor(resteMillions / 1_000);
  const resteMilliers = resteMillions % 1_000;
  if (milliers > 0) {
    if (milliers === 1) {
      parts.push("mille");
    } else {
      parts.push(`${centaineToWords(milliers)} mille`);
    }
  }

  // Centaines / dizaines / unités
  if (resteMilliers > 0) {
    parts.push(centaineToWords(resteMilliers));
  }

  const texte = parts.join(" ");

  // Pluriel de "franc"
  const francMot = n > 1 ? "francs CFA" : "franc CFA";
  return `${texte} ${francMot}`;
}
