import { describe, it, expect } from "vitest";
import { getTaxRateForCountry, BANK_COUNTRY_TAX_RATES, BANK_COUNTRIES } from "../tax-rates";

describe("Tax rate mapping", () => {
  it("Belarus → 14%", () => {
    expect(getTaxRateForCountry("BY")).toBe(14);
  });

  it("United States → 11.5%", () => {
    expect(getTaxRateForCountry("US")).toBe(11.5);
  });

  it("UAE → 0%", () => {
    expect(getTaxRateForCountry("AE")).toBe(0);
  });

  it("Georgia → 1%", () => {
    expect(getTaxRateForCountry("GE")).toBe(1);
  });

  it("unknown country returns undefined", () => {
    expect(getTaxRateForCountry("XX")).toBeUndefined();
  });

  it("case insensitive lookup", () => {
    expect(getTaxRateForCountry("by")).toBe(14);
    expect(getTaxRateForCountry("us")).toBe(11.5);
    expect(getTaxRateForCountry("ae")).toBe(0);
    expect(getTaxRateForCountry("ge")).toBe(1);
  });

  it("BANK_COUNTRIES contains all mapped countries", () => {
    expect(BANK_COUNTRIES).toContain("BY");
    expect(BANK_COUNTRIES).toContain("US");
    expect(BANK_COUNTRIES).toContain("AE");
    expect(BANK_COUNTRIES).toContain("GE");
    expect(BANK_COUNTRIES).toHaveLength(4);
  });

  it("all rates are non-negative numbers", () => {
    for (const [code, rate] of Object.entries(BANK_COUNTRY_TAX_RATES)) {
      expect(typeof rate).toBe("number");
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });
});
