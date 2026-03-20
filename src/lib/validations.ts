import { z } from "zod";
import { sanitizeText, sanitizeName } from "./sanitize";

// ── Helpers ──────────────────────────────────────────────────────

/** Zod transform that sanitizes free-text input */
const safeText = (maxLen: number) =>
  z.string().max(maxLen).transform(sanitizeText);

/** Zod transform that sanitizes name-like input */
const safeName = (maxLen: number) =>
  z.string().min(1).max(maxLen).transform(sanitizeName);

/** Non-negative money with sane upper bound and finite check */
const money = (max: number = 999_999.99) =>
  z.number().nonnegative().max(max).refine(
    (v) => Number.isFinite(v),
    { message: "Must be a valid number" }
  );

/** Positive money (must be > 0) */
const moneyPositive = (max: number = 999_999.99) =>
  z.number().positive().max(max).refine(
    (v) => Number.isFinite(v),
    { message: "Must be a valid positive number" }
  );

/** ISO date string (YYYY-MM-DD) */
const dateString = z.string().regex(
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  "Must be a valid date (YYYY-MM-DD)"
);

/** Strict https URL */
const httpsUrl = z.string().url().max(1000).refine(
  (v) => v.startsWith("https://") || v.startsWith("http://localhost"),
  { message: "URL must use HTTPS" }
);

/** UUID string */
export const uuidParam = z.string().uuid("Invalid ID format");

// ── Schemas ──────────────────────────────────────────────────────

export const inviteSchema = z.object({
  email: z
    .string()
    .max(254)
    .email()
    .refine((e) => e.endsWith("@interexy.com"), {
      message: "Only @interexy.com emails allowed",
    }),
  role: z.enum(["admin", "employee", "freelancer"]),
  entity: z.enum(["BY", "US", "CRYPTO"]),
});

export const createPeriodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  working_days: z.number().int().min(1).max(31),
});

export const updatePeriodSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "locked"]),
});

export const generatePayrollSchema = z.object({
  period_id: z.string().uuid(),
  entity: z.enum(["BY", "US", "CRYPTO"]),
});

export const updatePayrollSchema = z.object({
  days_worked: z.number().min(0).max(31).optional(),
  bonus: money().optional(),
  bonus_note: safeText(500).optional(),
  compensation_amount: money().optional(),
});

export const rejectPayrollSchema = z.object({
  rejection_reason: safeText(1000).pipe(z.string().min(1, "Rejection reason is required")),
});

export const createProjectSchema = z.object({
  name: safeName(100),
});

export const updateProjectSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "archived"]).optional(),
  name: safeName(100).optional(),
});

export const createContractSchema = z.object({
  employee_id: z.string().uuid(),
  gross_salary: moneyPositive(999_999.99),
  currency: z.enum(["USD", "EUR", "BYN", "PLN"]).default("USD"),
  effective_from: dateString,
  contract_type: z.enum(["primary", "amendment", "bonus", "part_time"]).default("primary"),
  notes: safeText(1000).optional().nullable(),
});

export const updateContractSchema = z.object({
  notes: safeText(1000).optional().nullable(),
  effective_to: dateString.nullable().optional(),
});

export const terminateContractSchema = z.object({
  terminated_at: dateString,
  notes: safeText(1000).optional().nullable(),
});

export const createRateSchema = z.object({
  freelancer_id: z.string().uuid(),
  project_id: z.string().uuid(),
  hourly_rate: moneyPositive(9_999.99),
  currency: z.enum(["USD", "EUR", "BYN", "PLN"]).default("USD"),
  effective_from: dateString,
});

export const updateRateSchema = z.object({
  hourly_rate: moneyPositive(9_999.99).optional(),
  effective_from: dateString.optional(),
  effective_to: dateString.nullable().optional(),
});

export const submitInvoiceSchema = z.object({
  period_id: z.string().uuid(),
  lines: z.array(
    z.object({
      project_id: z.string().uuid(),
      hours: z.number().nonnegative().max(744), // max hours in a month
    })
  ).max(50),
  bonus_lines: z.array(
    z.object({
      description: safeText(500).pipe(z.string().min(1, "Description is required")),
      amount: moneyPositive(),
    })
  ).max(20).optional().default([]),
  invoice_file_url: httpsUrl.optional().nullable(),
  time_report_url: httpsUrl.optional().nullable(),
  submit: z.boolean().default(false),
}).refine(
  (data) => data.lines.length > 0 || data.bonus_lines.length > 0,
  { message: "At least one line item is required", path: ["lines"] }
);

export const updateProfileSchema = z.object({
  first_name: safeName(50).optional(),
  last_name: safeName(50).optional(),
  department: z
    .enum(["Delivery", "HR / Sourcer", "Marketing", "Sales", "Leadgen", "Administrative"])
    .optional()
    .nullable(),
  payment_channel: z.enum(["AMC", "Interexy", "CRYPTO", "BANK", "PAYONEER"]).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
  role: z.enum(["admin", "employee", "freelancer"]).optional(),
  entity: z.enum(["BY", "US", "CRYPTO"]).optional(),
  contract_start_date: z.union([dateString, z.literal("")]).transform((v) => v || null).optional(),
  legal_address: safeText(500).transform((v) => v || null).optional(),
  personal_email: z.string().max(254).transform((v) => v || null).optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Invalid email" }),
  service_description: safeText(1000).transform((v) => v || null).optional(),
  invoice_number_prefix: safeText(20).transform((v) => v || null).optional(),
  invoice_number_seq: z.number().int().min(1).max(99_999).optional(),
  contract_date: z.union([dateString, z.literal("")]).transform((v) => v || null).optional(),
});

export const bankDetailsSchema = z.object({
  bank_name: z.string().max(100).transform(sanitizeText).optional().default(""),
  account_number: z.string().max(34)
    .regex(/^[\d\s\-]*$/, "Only digits, spaces, and dashes allowed")
    .transform((v) => v.replace(/\s+/g, " ").trim())
    .optional().default(""),
  swift: z.string().max(11)
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine((v) => v === "" || /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(v), {
      message: "SWIFT must be 8 or 11 alphanumeric characters",
    })
    .optional().default(""),
  iban: z.string().max(42)
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(v), {
      message: "Invalid IBAN format",
    })
    .optional().default(""),
  routing_number: z.string().max(9)
    .refine((v) => !v || /^\d{9}$/.test(v), {
      message: "Routing number must be exactly 9 digits",
    })
    .optional().default(""),
  bank_address: z.string().max(200).transform(sanitizeText).optional().default(""),
});

export const rejectInvoiceSchema = z.object({
  rejection_reason: safeText(1000).pipe(z.string().min(1, "Rejection reason is required")),
});
