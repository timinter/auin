import { describe, it, expect } from "vitest";
import { formatCurrency, getMonthName, formatPeriod, formatZodErrors, getInvoiceFileName, formatDisplayDate, formatDisplayDateTime } from "../utils";
import { ZodError, ZodIssue } from "zod";

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats EUR", () => {
    const result = formatCurrency(1000, "EUR");
    expect(result).toContain("1,000.00");
  });

  it("formats large amounts", () => {
    expect(formatCurrency(1_000_000)).toBe("$1,000,000.00");
  });

  it("pads to 2 decimal places", () => {
    expect(formatCurrency(5)).toBe("$5.00");
  });
});

describe("getMonthName", () => {
  it("returns January for 1", () => {
    expect(getMonthName(1)).toBe("January");
  });

  it("returns December for 12", () => {
    expect(getMonthName(12)).toBe("December");
  });

  it("returns June for 6", () => {
    expect(getMonthName(6)).toBe("June");
  });
});

describe("formatPeriod", () => {
  it("formats year and month", () => {
    expect(formatPeriod(2026, 3)).toBe("March 2026");
  });

  it("formats January", () => {
    expect(formatPeriod(2025, 1)).toBe("January 2025");
  });
});

describe("formatZodErrors", () => {
  it("extracts field errors from ZodError", () => {
    const issues: ZodIssue[] = [
      { code: "invalid_type", expected: "string", received: "number", path: ["email"], message: "Expected string" },
      { code: "too_small", minimum: 1, inclusive: true, type: "string", path: ["name"], message: "Too short" },
    ];
    const error = new ZodError(issues);
    const { fieldErrors, message } = formatZodErrors(error);

    expect(fieldErrors.email).toBe("Expected string");
    expect(fieldErrors.name).toBe("Too short");
    expect(message).toContain("email: Expected string");
    expect(message).toContain("name: Too short");
  });

  it("handles nested paths", () => {
    const issues: ZodIssue[] = [
      { code: "invalid_type", expected: "string", received: "number", path: ["lines", 0, "hours"], message: "Required" },
    ];
    const error = new ZodError(issues);
    const { fieldErrors } = formatZodErrors(error);

    expect(fieldErrors["lines.0.hours"]).toBe("Required");
  });

  it("uses 'input' for empty path", () => {
    const issues: ZodIssue[] = [
      { code: "custom", path: [], message: "Invalid" },
    ];
    const error = new ZodError(issues);
    const { fieldErrors } = formatZodErrors(error);

    expect(fieldErrors.input).toBe("Invalid");
  });
});

describe("getInvoiceFileName", () => {
  it("generates correct filename", () => {
    expect(getInvoiceFileName("Smith", 3, 2026)).toBe("Smith_March_2026.pdf");
  });

  it("handles different months", () => {
    expect(getInvoiceFileName("Doe", 12, 2025)).toBe("Doe_December_2025.pdf");
  });
});

describe("formatDisplayDate", () => {
  it("formats YYYY-MM-DD as DD/MM/YYYY", () => {
    expect(formatDisplayDate("2026-03-05")).toBe("05/03/2026");
  });

  it("formats single-digit day and month with leading zeros", () => {
    expect(formatDisplayDate("2026-01-09")).toBe("09/01/2026");
  });

  it("formats ISO datetime string", () => {
    expect(formatDisplayDate("2026-12-25T14:30:00.000Z")).toMatch(/^25\/12\/2026$/);
  });

  it("formats end-of-year date", () => {
    expect(formatDisplayDate("2025-12-31")).toBe("31/12/2025");
  });
});

describe("formatDisplayDateTime", () => {
  it("formats datetime as DD/MM/YYYY HH:MM", () => {
    const result = formatDisplayDateTime("2026-03-23T09:05:00");
    expect(result).toBe("23/03/2026 09:05");
  });

  it("pads single-digit hours and minutes", () => {
    const result = formatDisplayDateTime("2026-01-01T03:07:00");
    expect(result).toBe("01/01/2026 03:07");
  });
});
