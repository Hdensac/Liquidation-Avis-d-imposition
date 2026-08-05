import type { TaxPropertyType } from "@/types/liquidation";

export type TaxRule = {
  natureImpot: "TFU/FNB" | "TFU/FB";
  taux: number;
};

export const DEFAULT_TAX_PROPERTY_TYPE: TaxPropertyType = "NON_BATI";

export function normalizeTaxPropertyType(typeBien?: TaxPropertyType | string | null): TaxPropertyType {
  return typeBien === "BATI" ? "BATI" : DEFAULT_TAX_PROPERTY_TYPE;
}

export function getTaxRuleForYear(
  year: number,
  typeBien?: TaxPropertyType | string | null
): TaxRule {
  if (year === 2023) {
    return { natureImpot: "TFU/FNB", taux: 0.04 };
  }

  if (year === 2026 && normalizeTaxPropertyType(typeBien) === "BATI") {
    return { natureImpot: "TFU/FB", taux: 0.07 };
  }

  return { natureImpot: "TFU/FNB", taux: 0.05 };
}