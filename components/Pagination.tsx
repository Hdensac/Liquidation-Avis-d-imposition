"use client";

import React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { buildPageItems } from "@/lib/pagination";

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalCount,
  pageSize = 20,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);

  // Ne rien afficher si une seule page ou aucune donnée
  if (totalPages <= 1) return null;

  const items = buildPageItems(currentPage, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-1 mt-4 flex-wrap select-none"
    >
      {/* Bouton Précédent */}
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Page précédente"
        className="
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          text-gray-700 dark:text-gray-300
          hover:bg-gray-50 dark:hover:bg-gray-700
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors duration-150
        "
      >
        <ChevronLeft className="w-4 h-4" />
        Précédent
      </button>

      {/* Pages numérotées avec ellipsis */}
      {items.map((item, idx) =>
        item === null ? (
          <span
            key={`ellipsis-${idx}`}
            className="inline-flex items-center justify-center w-9 h-9 text-gray-400 dark:text-gray-400"
            aria-hidden="true"
          >
            <MoreHorizontal className="w-4 h-4" />
          </span>
        ) : (
          <button
            key={item}
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? "page" : undefined}
            className={`
              inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium
              border transition-colors duration-150
              ${
                item === currentPage
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }
            `}
          >
            {item}
          </button>
        )
      )}

      {/* Bouton Suivant */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Page suivante"
        className="
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          text-gray-700 dark:text-gray-300
          hover:bg-gray-50 dark:hover:bg-gray-700
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors duration-150
        "
      >
        Suivant
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Indicateur texte */}
      <span className="ml-3 text-xs text-gray-400 dark:text-gray-400 whitespace-nowrap">
        Page {currentPage} / {totalPages} &bull; {totalCount} résultat{totalCount > 1 ? "s" : ""}
      </span>
    </nav>
  );
}
