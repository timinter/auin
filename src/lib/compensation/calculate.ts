import type { CompensationCategory } from "@/types";

export interface CompensationInput {
  /** Amount from the receipt in original currency */
  submittedAmount: number;
  /** Currency: 'BYN' or 'USD' */
  submittedCurrency: string;
  /** BYN→USD exchange rate (NBRB). Only needed when currency is BYN */
  exchangeRate: number | null;
  /** Category rules */
  category: Pick<
    CompensationCategory,
    "name" | "limit_percentage" | "max_gross" | "annual_max_gross" | "is_prorated"
  >;
  /** Employee's individual tax rate, e.g. 0.13 */
  taxRate: number;
  /** Total already-approved gross USD for this category in the current year (for annual caps) */
  yearToDateApproved: number;
}

export interface CompensationBreakdown {
  /** Original receipt amount */
  receiptAmount: number;
  /** After applying company coverage % */
  afterPercentage: number;
  /** Converted to USD (same as afterPercentage if already USD) */
  amountUsd: number;
  /** After gross-up with tax */
  grossAmount: number;
  /** After applying monthly/annual cap */
  approvedGross: number;
  /** Cap that was applied, if any */
  capApplied: string | null;
}

/**
 * Calculate the approved gross USD amount for a compensation receipt.
 *
 * Flow:
 * 1. Apply company coverage % (e.g. 50% for sport → take half)
 * 2. Convert BYN → USD (skip if already USD)
 * 3. Gross up: net / (1 - taxRate)
 * 4. Apply monthly cap (max_gross) or annual cap (annual_max_gross - ytdApproved)
 */
export function calculateCompensation(input: CompensationInput): CompensationBreakdown {
  const { submittedAmount, submittedCurrency, exchangeRate, category, taxRate, yearToDateApproved } = input;

  // 1. Apply company coverage percentage
  const coverageRate = category.limit_percentage != null ? category.limit_percentage / 100 : 1;
  const afterPercentage = round(submittedAmount * coverageRate);

  // 2. Convert to USD
  let amountUsd: number;
  if (submittedCurrency === "USD") {
    amountUsd = afterPercentage;
  } else {
    if (!exchangeRate || exchangeRate <= 0) {
      throw new Error("Exchange rate required for BYN conversion");
    }
    amountUsd = round(afterPercentage / exchangeRate);
  }

  // 3. Gross up: net / (1 - taxRate)
  const effectiveTaxRate = Math.max(0, Math.min(taxRate, 1));
  const grossAmount = effectiveTaxRate < 1
    ? round(amountUsd / (1 - effectiveTaxRate))
    : amountUsd;

  // 4. Apply caps
  let approvedGross = grossAmount;
  let capApplied: string | null = null;

  // Monthly cap
  if (category.max_gross != null && approvedGross > category.max_gross) {
    approvedGross = category.max_gross;
    capApplied = `Monthly cap: $${category.max_gross}`;
  }

  // Annual cap (remaining room)
  if (category.annual_max_gross != null) {
    const annualCap = category.is_prorated
      ? round(category.annual_max_gross / 12)
      : category.annual_max_gross;
    const remaining = Math.max(0, annualCap - yearToDateApproved);
    if (approvedGross > remaining) {
      approvedGross = round(remaining);
      capApplied = `Annual cap: $${category.annual_max_gross} (remaining: $${remaining.toFixed(2)})`;
    }
  }

  return {
    receiptAmount: submittedAmount,
    afterPercentage,
    amountUsd,
    grossAmount,
    approvedGross: Math.max(0, approvedGross),
    capApplied,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
