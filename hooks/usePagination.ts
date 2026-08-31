"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PAGE_SIZE } from "@/lib/pagination";

export interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageSize = options.pageSize ?? PAGE_SIZE;

  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const setPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", page.toString());
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const resetPage = useCallback(() => {
    if (searchParams.has("page")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [router, pathname, searchParams]);

  return {
    currentPage,
    pageSize,
    setPage,
    resetPage,
  };
}
