import { describe, it, expect } from "vitest";
import {
  inviteSchema,
  createPeriodSchema,
  updatePayrollSchema,
  createContractSchema,
  updateContractSchema,
  submitInvoiceSchema,
  bankDetailsSchema,
  bankAccountSchema,
  payrollSplitSchema,
  uuidParam,
  updateProfileSchema,
  rejectPayrollSchema,
  rejectInvoiceSchema,
  createLeaveSchema,
  reviewLeaveSchema,
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

  it("accepts freelancer_type individual", () => {
    const result = updateProfileSchema.safeParse({ freelancer_type: "individual" });
    expect(result.success).toBe(true);
  });

  it("accepts freelancer_type legal_entity", () => {
    const result = updateProfileSchema.safeParse({ freelancer_type: "legal_entity" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid freelancer_type", () => {
    const result = updateProfileSchema.safeParse({ freelancer_type: "corporation" });
    expect(result.success).toBe(false);
  });

  it("accepts legal entity fields", () => {
    const result = updateProfileSchema.safeParse({
      freelancer_type: "legal_entity",
      company_name: "My Company LLC",
      registration_number: "123456789",
      company_address: "123 Business St",
      signatory_name: "John Doe",
      signatory_position: "Director",
      is_vat_payer: true,
    });
    expect(result.success).toBe(true);
  });

  it("sanitizes company_name", () => {
    const result = updateProfileSchema.safeParse({ company_name: 'Test<img onerror="alert(1)">Co' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company_name).not.toContain("onerror");
    }
  });

  it("nullifies empty company_name", () => {
    const result = updateProfileSchema.safeParse({ company_name: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company_name).toBeNull();
    }
  });

  it("accepts valid bank_country", () => {
    expect(updateProfileSchema.safeParse({ bank_country: "BY" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ bank_country: "US" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ bank_country: "AE" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ bank_country: "GE" }).success).toBe(true);
  });

  it("rejects invalid bank_country", () => {
    expect(updateProfileSchema.safeParse({ bank_country: "DE" }).success).toBe(false);
  });

  it("nullifies empty bank_country", () => {
    const result = updateProfileSchema.safeParse({ bank_country: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bank_country).toBeNull();
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

describe("createLeaveSchema", () => {
  it("accepts valid leave request", () => {
    const result = createLeaveSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      leave_type: "unpaid",
      start_date: "2026-03-10",
      end_date: "2026-03-14",
      days_count: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts leave with reason", () => {
    const result = createLeaveSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      leave_type: "sick",
      start_date: "2026-03-10",
      end_date: "2026-03-10",
      days_count: 1,
      reason: "Doctor appointment",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid leave type", () => {
    const result = createLeaveSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      leave_type: "maternity",
      start_date: "2026-03-10",
      end_date: "2026-03-14",
      days_count: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero days_count", () => {
    const result = createLeaveSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      leave_type: "unpaid",
      start_date: "2026-03-10",
      end_date: "2026-03-14",
      days_count: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects days_count > 31", () => {
    const result = createLeaveSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      leave_type: "vacation",
      start_date: "2026-03-01",
      end_date: "2026-03-31",
      days_count: 32,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = createLeaveSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      leave_type: "unpaid",
      start_date: "03/10/2026",
      end_date: "03/14/2026",
      days_count: 5,
    });
    expect(result.success).toBe(false);
  });

  it("sanitizes HTML in reason", () => {
    const result = createLeaveSchema.safeParse({
      period_id: "550e8400-e29b-41d4-a716-446655440000",
      leave_type: "unpaid",
      start_date: "2026-03-10",
      end_date: "2026-03-14",
      days_count: 5,
      reason: "<script>alert(1)</script>Personal",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).not.toContain("<script>");
    }
  });
});

describe("reviewLeaveSchema", () => {
  it("accepts approval without reason", () => {
    const result = reviewLeaveSchema.safeParse({ status: "approved" });
    expect(result.success).toBe(true);
  });

  it("accepts rejection with reason", () => {
    const result = reviewLeaveSchema.safeParse({
      status: "rejected",
      rejection_reason: "Not enough notice",
    });
    expect(result.success).toBe(true);
  });

  it("rejects rejection without reason", () => {
    const result = reviewLeaveSchema.safeParse({ status: "rejected" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = reviewLeaveSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
  });
});

describe("updateContractSchema", () => {
  it("accepts partial update with gross_salary only", () => {
    const result = updateContractSchema.safeParse({ gross_salary: 6000 });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with effective_from only", () => {
    const result = updateContractSchema.safeParse({ effective_from: "2026-04-01" });
    expect(result.success).toBe(true);
  });

  it("accepts nullable effective_to", () => {
    const result = updateContractSchema.safeParse({ effective_to: null });
    expect(result.success).toBe(true);
  });

  it("accepts effective_to date", () => {
    const result = updateContractSchema.safeParse({ effective_to: "2026-06-30" });
    expect(result.success).toBe(true);
  });

  it("accepts contract_type change", () => {
    const result = updateContractSchema.safeParse({ contract_type: "amendment" });
    expect(result.success).toBe(true);
  });

  it("rejects zero gross_salary", () => {
    const result = updateContractSchema.safeParse({ gross_salary: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative gross_salary", () => {
    const result = updateContractSchema.safeParse({ gross_salary: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format", () => {
    const result = updateContractSchema.safeParse({ effective_from: "04/01/2026" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid contract_type", () => {
    const result = updateContractSchema.safeParse({ contract_type: "full_time" });
    expect(result.success).toBe(false);
  });

  it("sanitizes notes", () => {
    const result = updateContractSchema.safeParse({ notes: '<script>alert("xss")</script>Raise' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).not.toContain("<script>");
    }
  });

  it("accepts empty object (no fields required)", () => {
    const result = updateContractSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("rejectInvoiceSchema", () => {
  it("accepts valid rejection reason", () => {
    const result = rejectInvoiceSchema.safeParse({ rejection_reason: "Wrong hours reported" });
    expect(result.success).toBe(true);
  });

  it("rejects empty reason", () => {
    const result = rejectInvoiceSchema.safeParse({ rejection_reason: "" });
    expect(result.success).toBe(false);
  });

  it("sanitizes HTML in reason", () => {
    const result = rejectInvoiceSchema.safeParse({ rejection_reason: '<img onerror="alert(1)">Bad data' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rejection_reason).not.toContain("onerror");
    }
  });
});

describe("bankAccountSchema", () => {
  it("accepts valid bank account", () => {
    const result = bankAccountSchema.safeParse({
      label: "Main USD",
      bank_name: "Chase",
      iban: "US12345678901234567890",
      swift: "CHASUS33",
    });
    expect(result.success).toBe(true);
  });

  it("requires label", () => {
    const result = bankAccountSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = bankAccountSchema.safeParse({ label: "" });
    expect(result.success).toBe(false);
  });

  it("defaults is_primary to false", () => {
    const result = bankAccountSchema.safeParse({ label: "Secondary" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_primary).toBe(false);
    }
  });

  it("validates SWIFT format", () => {
    expect(bankAccountSchema.safeParse({ label: "X", swift: "DEUT" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ label: "X", swift: "DEUTDEFF" }).success).toBe(true);
    expect(bankAccountSchema.safeParse({ label: "X", swift: "DEUTDEFFXXX" }).success).toBe(true);
  });

  it("validates routing number (9 digits)", () => {
    expect(bankAccountSchema.safeParse({ label: "X", routing_number: "12345" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ label: "X", routing_number: "021000021" }).success).toBe(true);
  });
});

describe("payrollSplitSchema", () => {
  it("accepts valid splits", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [
        { bank_account_id: "550e8400-e29b-41d4-a716-446655440000", amount: 3000 },
        { bank_account_id: "660e8400-e29b-41d4-a716-446655440000", amount: 2000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one split", () => {
    const result = payrollSplitSchema.safeParse({ splits: [] });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [{ bank_account_id: "550e8400-e29b-41d4-a716-446655440000", amount: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [{ bank_account_id: "550e8400-e29b-41d4-a716-446655440000", amount: -500 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid bank_account_id", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [{ bank_account_id: "not-a-uuid", amount: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 splits", () => {
    const splits = Array.from({ length: 11 }, (_, i) => ({
      bank_account_id: `550e8400-e29b-41d4-a716-44665544000${i}`,
      amount: 100,
    }));
    const result = payrollSplitSchema.safeParse({ splits });
    expect(result.success).toBe(false);
  });
});
