import { describe, it, expect } from "vitest";
import { bankAccountSchema, payrollSplitSchema } from "../validations";

// ─── bankAccountSchema ──────────────────────────────────────────

describe("bankAccountSchema", () => {
  it("accepts valid bank account with all fields", () => {
    const result = bankAccountSchema.safeParse({
      label: "Main Bank",
      bank_name: "Chase",
      account_number: "123456789",
      swift: "CHASUS33",
      iban: "US12345678901234567890",
      routing_number: "021000021",
      bank_address: "123 Wall St",
      is_primary: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires label", () => {
    const result = bankAccountSchema.safeParse({
      bank_name: "Chase",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty label", () => {
    const result = bankAccountSchema.safeParse({
      label: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts minimal bank account (label only)", () => {
    const result = bankAccountSchema.safeParse({
      label: "My Bank",
    });
    expect(result.success).toBe(true);
  });

  it("sanitizes label (strips HTML)", () => {
    const result = bankAccountSchema.safeParse({
      label: '<script>alert("xss")</script>My Bank',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label).not.toContain("<script>");
    }
  });

  it("validates SWIFT format", () => {
    const valid = bankAccountSchema.safeParse({ label: "Test", swift: "DEUTDEFF" });
    expect(valid.success).toBe(true);

    const invalid = bankAccountSchema.safeParse({ label: "Test", swift: "SHORT" });
    expect(invalid.success).toBe(false);
  });

  it("validates IBAN format", () => {
    const valid = bankAccountSchema.safeParse({ label: "Test", iban: "DE89370400440532013000" });
    expect(valid.success).toBe(true);

    const invalid = bankAccountSchema.safeParse({ label: "Test", iban: "invalid" });
    expect(invalid.success).toBe(false);
  });

  it("validates routing number (exactly 9 digits)", () => {
    const valid = bankAccountSchema.safeParse({ label: "Test", routing_number: "021000021" });
    expect(valid.success).toBe(true);

    const invalid = bankAccountSchema.safeParse({ label: "Test", routing_number: "12345" });
    expect(invalid.success).toBe(false);
  });

  it("allows empty SWIFT/IBAN/routing (optional fields)", () => {
    const result = bankAccountSchema.safeParse({
      label: "Test",
      swift: "",
      iban: "",
      routing_number: "",
    });
    expect(result.success).toBe(true);
  });

  it("defaults is_primary to false", () => {
    const result = bankAccountSchema.safeParse({ label: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_primary).toBe(false);
    }
  });

  it("label max length is 50", () => {
    const result = bankAccountSchema.safeParse({ label: "A".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("account_number only allows digits, spaces, dashes", () => {
    const valid = bankAccountSchema.safeParse({ label: "Test", account_number: "123-456 789" });
    expect(valid.success).toBe(true);

    const invalid = bankAccountSchema.safeParse({ label: "Test", account_number: "ABC123!" });
    expect(invalid.success).toBe(false);
  });
});

// ─── payrollSplitSchema ─────────────────────────────────────────

describe("payrollSplitSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validUuid2 = "660e8400-e29b-41d4-a716-446655440000";

  it("accepts valid single split", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [{ bank_account_id: validUuid, amount: 5000 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid multiple splits", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [
        { bank_account_id: validUuid, amount: 3000 },
        { bank_account_id: validUuid2, amount: 2000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty splits array", () => {
    const result = payrollSplitSchema.safeParse({ splits: [] });
    expect(result.success).toBe(false);
  });

  it("rejects split with zero amount", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [{ bank_account_id: validUuid, amount: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects split with negative amount", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [{ bank_account_id: validUuid, amount: -100 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects split with invalid UUID", () => {
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

  it("accepts amounts with cents", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [
        { bank_account_id: validUuid, amount: 1500.50 },
        { bank_account_id: validUuid2, amount: 3199.50 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects amount exceeding max", () => {
    const result = payrollSplitSchema.safeParse({
      splits: [{ bank_account_id: validUuid, amount: 1_000_000 }],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Split amount validation logic (pure functions) ─────────────

describe("Split amount calculations", () => {
  function validateSplitSum(splits: { amount: number }[], totalAmount: number): boolean {
    const sum = Math.round(splits.reduce((s, sp) => s + sp.amount, 0) * 100) / 100;
    return Math.abs(sum - totalAmount) <= 0.01;
  }

  it("single split equals total", () => {
    expect(validateSplitSum([{ amount: 4700 }], 4700)).toBe(true);
  });

  it("two splits sum to total", () => {
    expect(validateSplitSum([{ amount: 1500 }, { amount: 3200 }], 4700)).toBe(true);
  });

  it("three splits sum to total", () => {
    expect(validateSplitSum(
      [{ amount: 1000 }, { amount: 2000 }, { amount: 1700 }],
      4700
    )).toBe(true);
  });

  it("splits with cents sum correctly", () => {
    expect(validateSplitSum(
      [{ amount: 1500.50 }, { amount: 3199.50 }],
      4700
    )).toBe(true);
  });

  it("detects sum mismatch", () => {
    expect(validateSplitSum([{ amount: 1500 }, { amount: 3000 }], 4700)).toBe(false);
  });

  it("handles floating point edge case (0.1 + 0.2)", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(validateSplitSum([{ amount: 0.1 }, { amount: 0.2 }], 0.3)).toBe(true);
  });

  it("zero total with no splits is valid", () => {
    expect(validateSplitSum([], 0)).toBe(true);
  });

  it("detects over-allocation", () => {
    expect(validateSplitSum([{ amount: 3000 }, { amount: 2000 }], 4700)).toBe(false);
  });

  it("detects under-allocation", () => {
    expect(validateSplitSum([{ amount: 1000 }], 4700)).toBe(false);
  });

  it("handles large amounts", () => {
    expect(validateSplitSum(
      [{ amount: 50000 }, { amount: 100000 }, { amount: 50000 }],
      200000
    )).toBe(true);
  });
});
