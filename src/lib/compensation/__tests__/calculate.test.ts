import { calculateCompensation, CompensationInput } from "../calculate";

const baseCategory = {
  name: "sport",
  limit_percentage: 50,
  max_gross: 40,
  annual_max_gross: null,
  is_prorated: false,
};

const baseInput: CompensationInput = {
  submittedAmount: 300,
  submittedCurrency: "BYN",
  exchangeRate: 2.9595,
  category: baseCategory,
  taxRate: 0.13,
  yearToDateApproved: 0,
};

describe("calculateCompensation", () => {
  describe("Sport category (50%, cap $40)", () => {
    it("calculates sport: 300 BYN → 50% → USD → gross → capped at $40", () => {
      const result = calculateCompensation(baseInput);
      // 300 * 0.5 = 150 BYN
      expect(result.afterPercentage).toBe(150);
      // 150 / 2.9595 ≈ 50.68
      expect(result.amountUsd).toBeCloseTo(50.68, 1);
      // 50.68 / (1 - 0.13) ≈ 58.25
      expect(result.grossAmount).toBeCloseTo(58.25, 0);
      // Capped at 40
      expect(result.approvedGross).toBe(40);
      expect(result.capApplied).toContain("Monthly cap");
    });

    it("calculates sport below cap: 150 BYN", () => {
      const result = calculateCompensation({ ...baseInput, submittedAmount: 150 });
      // 150 * 0.5 = 75 BYN
      expect(result.afterPercentage).toBe(75);
      // 75 / 2.9595 ≈ 25.34
      expect(result.amountUsd).toBeCloseTo(25.34, 1);
      // 25.34 / 0.87 ≈ 29.13
      expect(result.grossAmount).toBeCloseTo(29.13, 0);
      // Under cap
      expect(result.approvedGross).toBeCloseTo(29.13, 0);
      expect(result.capApplied).toBeNull();
    });
  });

  describe("Health Insurance (100%, annual cap $450, prorated)", () => {
    const healthCategory = {
      name: "health_insurance",
      limit_percentage: null,
      max_gross: null,
      annual_max_gross: 450,
      is_prorated: true,
    };

    it("calculates with annual cap and no prior usage", () => {
      const result = calculateCompensation({
        ...baseInput,
        submittedAmount: 500,
        category: healthCategory,
        yearToDateApproved: 0,
      });
      // No percentage limit → full 500 BYN
      expect(result.afterPercentage).toBe(500);
      // 500 / 2.9595 ≈ 168.92
      expect(result.amountUsd).toBeCloseTo(168.92, 0);
      // Gross up: 168.92 / 0.87 ≈ 194.16
      expect(result.grossAmount).toBeCloseTo(194.16, 0);
      // Prorated annual cap: 450/12 = 37.5, so capped
      expect(result.approvedGross).toBe(37.5);
      expect(result.capApplied).toContain("Annual cap");
    });

    it("respects year-to-date approved against annual cap", () => {
      const result = calculateCompensation({
        ...baseInput,
        submittedAmount: 200,
        category: healthCategory,
        yearToDateApproved: 30, // already used $30 of the $37.50 monthly prorated cap
      });
      // Prorated: 450/12 = 37.5, remaining = 37.5 - 30 = 7.5
      expect(result.approvedGross).toBe(7.5);
    });

    it("returns 0 when annual cap fully used", () => {
      const result = calculateCompensation({
        ...baseInput,
        submittedAmount: 200,
        category: healthCategory,
        yearToDateApproved: 37.5,
      });
      expect(result.approvedGross).toBe(0);
    });
  });

  describe("AI Tools (no %, cap $50)", () => {
    const aiCategory = {
      name: "ai_tools",
      limit_percentage: null,
      max_gross: 50,
      annual_max_gross: null,
      is_prorated: false,
    };

    it("calculates full amount with monthly cap", () => {
      const result = calculateCompensation({
        ...baseInput,
        submittedAmount: 200,
        category: aiCategory,
      });
      // Full amount: 200 BYN → USD → gross → capped at $50
      expect(result.afterPercentage).toBe(200);
      expect(result.approvedGross).toBe(50);
    });
  });

  describe("Parking (100%, no cap)", () => {
    const parkingCategory = {
      name: "parking",
      limit_percentage: 100,
      max_gross: null,
      annual_max_gross: null,
      is_prorated: false,
    };

    it("reimburses 100% with no cap", () => {
      const result = calculateCompensation({
        ...baseInput,
        submittedAmount: 100,
        category: parkingCategory,
      });
      // 100 * 1.0 = 100 BYN → 100/2.9595 ≈ 33.79 → gross ≈ 38.84
      expect(result.afterPercentage).toBe(100);
      expect(result.capApplied).toBeNull();
      expect(result.approvedGross).toBeCloseTo(38.84, 0);
    });
  });

  describe("USD submissions", () => {
    it("skips conversion for USD amounts", () => {
      const result = calculateCompensation({
        ...baseInput,
        submittedAmount: 30,
        submittedCurrency: "USD",
        exchangeRate: null,
        category: { ...baseCategory, limit_percentage: null, max_gross: null },
      });
      // No conversion: 30 USD → gross: 30/0.87 ≈ 34.48
      expect(result.amountUsd).toBe(30);
      expect(result.grossAmount).toBeCloseTo(34.48, 1);
      expect(result.approvedGross).toBeCloseTo(34.48, 1);
    });
  });

  describe("Edge cases", () => {
    it("throws when BYN but no exchange rate", () => {
      expect(() =>
        calculateCompensation({ ...baseInput, exchangeRate: null })
      ).toThrow("Exchange rate required");
    });

    it("handles zero submitted amount", () => {
      const result = calculateCompensation({ ...baseInput, submittedAmount: 0 });
      expect(result.approvedGross).toBe(0);
    });

    it("handles zero tax rate", () => {
      const result = calculateCompensation({ ...baseInput, taxRate: 0 });
      // No gross-up: amountUsd should equal grossAmount
      expect(result.grossAmount).toBe(result.amountUsd);
    });

    it("clamps tax rate to [0, 1]", () => {
      const result = calculateCompensation({ ...baseInput, taxRate: 1.5 });
      // taxRate clamped to 1 → no division, grossAmount = amountUsd
      expect(result.grossAmount).toBe(result.amountUsd);
    });
  });
});
