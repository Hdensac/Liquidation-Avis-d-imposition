// lib/pagination.ts
// Utilitaire de pagination partagé par HistoryTable et PendingLiquidationsTable

/** Nombre de résultats affichés par page (côté serveur) */
export const PAGE_SIZE = 20;

/**
 * Calcule le [from, to] à passer à Supabase .range(from, to)
 * @param page  Numéro de page 1-indexé
 * @param size  Taille de page (default PAGE_SIZE)
 */
export function getRange(page: number, size: number = PAGE_SIZE): [number, number] {
  const from = (page - 1) * size;
  const to = from + size - 1;
  return [from, to];
}

/**
 * Génère la liste de numéros de pages à afficher avec troncature ("...").
 * Retourne toujours max 7 éléments visibles (chiffres ou null = ellipsis).
 */
export function buildPageItems(
  currentPage: number,
  totalPages: number
): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: (number | null)[] = [];
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);

  items.push(1);
  if (left > 2) items.push(null); // ellipsis gauche
  for (let i = left; i <= right; i++) items.push(i);
  if (right < totalPages - 1) items.push(null); // ellipsis droit
  items.push(totalPages);

  return items;
}
