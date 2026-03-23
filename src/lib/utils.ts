import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ZodError } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getMonthName(month: number): string {
  const date = new Date(2000, month - 1);
  return date.toLocaleString("en-US", { month: "long" });
}

export function formatPeriod(year: number, month: number): string {
  return `${getMonthName(month)} ${year}`;
}

/** Format Zod errors into { field: message } map + combined string */
export function formatZodErrors(error: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "input";
    fieldErrors[field] = issue.message;
  }
  const message = Object.entries(fieldErrors)
    .map(([field, msg]) => `${field}: ${msg}`)
    .join("; ");
  return { fieldErrors, message };
}

/** Extract error message from API response */
export async function getApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error || "Something went wrong";
  } catch (err) {
    console.error(err);
    return "Something went wrong";
  }
}

export function getInvoiceFileName(
  lastName: string,
  month: number,
  year: number
): string {
  return `${lastName}_${getMonthName(month)}_${year}.pdf`;
}
