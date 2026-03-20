import { describe, it, expect } from "vitest";
import {
  inviteSchema,
  createPeriodSchema,
  updatePayrollSchema,
  createContractSchema,
  submitInvoiceSchema,
  bankDetailsSchema,
  uuidParam,
  updateProfileSchema,
  rejectPayrollSchema,
} from "../validations";

describe("inviteSchema", () => {
  it("accepts valid invite", () => {
    const result = inviteSchema.safeParse({
      email: "john@interexy.com",
      role: "employee",
      entity: "US",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-interexy email", () => {
    const result = inviteSchema.safeParse({
      email: "john@gmail.com",
      role: "employee",
      entity: "US",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = inviteSchema.safeParse({
      email: "john@interexy.com",
      role: "superadmin",
      entity: "US",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid entity", () => {
    const result = inviteSchema.safeParse({
      email: "john@interexy.com",
      role: "admin",
      entity: "UK",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPeriodSchema", () => {
  it("accepts valid period", () => {
    const result = createPeriodSchema.safeParse({ year: 2026, month: 3, working_days: 22 });
    expect(result.success).toBe(true);
  });

  it("rejects year below 2020", () => {
    const result = createPeriodSchema.safeParse({ year: 2019, month: 3, working_days: 22 });
    expect(result.success).toBe(false);
  });

  it("rejects month 0", () => {
    const result = createPeriodSchema.safeParse({ year: 2026, month: 0, working_days: 22 });
    expect(result.success).toBe(false);
  });

  it("rejects month 13", () => {
    const result = createPeriodSchema.safeParse({ year: 2026, month: 13, working_days: 22 });
    expect(result.success).toBe(false);
  });

  it("rejects 0 working days", () => {
    const result = createPeriodSchema.safeParse({ year: 2026, month: 3, working_days: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects 32 working days", () => {
    const result = createPeriodSchema.safeParse({ year: 2026, month: 3, working_days: 32 });
    expect(result.success).toBe(false);
  });
});

describe("updatePayrollSchema", () => {
  it("accepts partial updates", () => {
    const result = updatePayrollSchema.safeParse({ bonus: 500 });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updatePayrollSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects negative bonus", () => {
    const result = updatePayrollSchema.safeParse({ bonus: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects days_worked > 31", () => {
    const result = updatePayrollSchema.safeParse({ days_worked: 32 });
    expect(result.success).toBe(false);
  });

  it("sanitizes bonus_note", () => {
    const result = updatePayrollSchema.safeParse({ bonus_note: '<script>alert("xss")</script>' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bonus_note).not.toContain("<script>");
    }
  });

  it("accepts positive adjustment_amount", () => {
    const result = updatePayrollSchema.safeParse({ adjustment_amount: 200 });
    expect(result.success).toBe(true);
  });

  it("accepts negative adjustment_amount (deduction)", () => {
    const result = updatePayrollSchema.safeParse({ adjustment_amount: -500 });
    expect(result.success).toBe(true);
  });

  it("rejects adjustment_amount exceeding max", () => {
    const result = updatePayrollSchema.safeParse({ adjustment_amount: 100_000 });
    expect(result.success).toBe(false);
  });

  it("accepts adjustment_reason", () => {
    const result = updatePayrollSchema.safeParse({ adjustment_amount: -100, adjustment_reason: "Late penalty" });
    expect(result.success).toBe(true);
  });

  it("sanitizes adjustment_reason", () => {
    const result = updatePayrollSchema.safeParse({ adjustment_reason: '<img onerror="alert(1)">' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.adjustment_reason).not.toContain("onerror");
    }
  });
});

describe("createContractSchema", () => {
  it("accepts valid contract", () => {
    const result = createContractSchema.safeParse({
      employee_id: "550e8400-e29b-41d4-a716-446655440000",
      gross_salary: 5000,
      currency: "USD",
      effective_from: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero salary", () => {
    const result = createContractSchema.safeParse({
      employee_id: "550e8400-e29b-41d4-a716-446655440000",
      gross_salary: 0,
      currency: "USD",
      effective_from: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = createContractSchema.safeParse({
      employee_id: "550e8400-e29b-41d4-a716-446655440000",
      gross_salary: 5000,
      effective_from: "03/01/2026",
    });
    expect(result.success).toBe(false);
  });

  it("defaults to USD currency", () => {
    const result = createContractSchema.safeParse({
      employee_id: "550e8400-e29b-41d4-a716-446655440000",
      gross_salary: 5000,
      effective_from: "2026-03-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("USD");
    }
  });

  it("rejects invalid currency", () => {
    const result = createContractSchema.safeParse({
      employee_id: "550e8400-e29b-41d4-a716-446655440000",
      gross_salary: 5000,
      currency: "GBP",
      effective_from: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("submitInvoiceSchema", () => {
  it("accepts valid invoice with lines", () => {
    const result = submitInvoiceSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      lines: [{ project_id: "550e8400-e29b-41d4-a716-446655440000", hours: 160 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty lines and no bonus_lines", () => {
    const result = submitInvoiceSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      lines: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts bonus_lines without regular lines", () => {
    const result = submitInvoiceSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      lines: [],
      bonus_lines: [{ description: "Referral bonus", amount: 500 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects hours > 744", () => {
    const result = submitInvoiceSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      lines: [{ project_id: "550e8400-e29b-41d4-a716-446655440000", hours: 745 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects http URL (requires https)", () => {
    const result = submitInvoiceSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      lines: [{ project_id: "550e8400-e29b-41d4-a716-446655440000", hours: 10 }],
      invoice_file_url: "http://evil.com/file.pdf",
    });
    expect(result.success).toBe(false);
  });
});

describe("bankDetailsSchema", () => {
  it("accepts valid bank details", () => {
    const result = bankDetailsSchema.safeParse({
      bank_name: "Deutsche Bank",
      swift: "DEUTDEFF",
      iban: "DE89370400440532013000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all defaults)", () => {
    const result = bankDetailsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("normalizes SWIFT to uppercase", () => {
    const result = bankDetailsSchema.safeParse({ swift: "deutdeff" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.swift).toBe("DEUTDEFF");
    }
  });

  it("normalizes IBAN to uppercase without spaces", () => {
    const result = bankDetailsSchema.safeParse({ iban: "de89 3704 0044 0532 0130 00" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.iban).toBe("DE89370400440532013000");
    }
  });

  it("rejects invalid SWIFT length", () => {
    const result = bankDetailsSchema.safeParse({ swift: "DEUT" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid routing number", () => {
    const result = bankDetailsSchema.safeParse({ routing_number: "12345" });
    expect(result.success).toBe(false);
  });

  it("accepts valid routing number", () => {
    const result = bankDetailsSchema.safeParse({ routing_number: "021000021" });
    expect(result.success).toBe(true);
  });
});

describe("uuidParam", () => {
  it("accepts valid UUID", () => {
    expect(uuidParam.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(uuidParam.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts valid department", () => {
    const result = updateProfileSchema.safeParse({ department: "HR / Sourcer" });
    expect(result.success).toBe(true);
  });

  it("rejects removed Development department", () => {
    const result = updateProfileSchema.safeParse({ department: "Development" });
    expect(result.success).toBe(false);
  });

  it("sanitizes first_name", () => {
    const result = updateProfileSchema.safeParse({ first_name: "John<script>" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.first_name).toBe("John");
    }
  });
});

describe("rejectPayrollSchema", () => {
  it("requires non-empty reason", () => {
    const result = rejectPayrollSchema.safeParse({ rejection_reason: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid reason", () => {
    const result = rejectPayrollSchema.safeParse({ rejection_reason: "Incorrect hours" });
    expect(result.success).toBe(true);
  });

  it("sanitizes HTML from reason", () => {
    const result = rejectPayrollSchema.safeParse({ rejection_reason: "<b>Wrong</b> data" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rejection_reason).not.toContain("<b>");
    }
  });
});
