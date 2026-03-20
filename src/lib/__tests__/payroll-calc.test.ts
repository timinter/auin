import { describe, it, expect } from "vitest";
import { countWorkingDaysInRange, calculateEffectiveGross, type ContractRow } from "../payroll-calc";

describe("countWorkingDaysInRange", () => {
  const noHolidays = new Set<string>();

  it("counts weekdays in a full week", () => {
    // 2026-03-02 (Mon) to 2026-03-06 (Fri)
    expect(countWorkingDaysInRange("2026-03-02", "2026-03-06", noHolidays)).toBe(5);
  });

  it("excludes weekends", () => {
    // 2026-03-02 (Mon) to 2026-03-08 (Sun) — still 5 working days
    expect(countWorkingDaysInRange("2026-03-02", "2026-03-08", noHolidays)).toBe(5);
  });

  it("returns 0 for a weekend-only range", () => {
    // 2026-03-07 (Sat) to 2026-03-08 (Sun)
    expect(countWorkingDaysInRange("2026-03-07", "2026-03-08", noHolidays)).toBe(0);
  });

  it("excludes holidays", () => {
    const holidays = new Set(["2026-03-03", "2026-03-05"]);
    // Mon-Fri but 2 holidays → 3 working days
    expect(countWorkingDaysInRange("2026-03-02", "2026-03-06", holidays)).toBe(3);
  });

  it("handles a single day (weekday)", () => {
    expect(countWorkingDaysInRange("2026-03-02", "2026-03-02", noHolidays)).toBe(1);
  });

  it("handles a single day (weekend)", () => {
    expect(countWorkingDaysInRange("2026-03-07", "2026-03-07", noHolidays)).toBe(0);
  });

  it("counts full month of March 2026 correctly", () => {
    // March 2026 has 22 weekdays
    expect(countWorkingDaysInRange("2026-03-01", "2026-03-31", noHolidays)).toBe(22);
  });

  it("holiday on weekend has no effect", () => {
    const holidays = new Set(["2026-03-07"]); // Saturday
    expect(countWorkingDaysInRange("2026-03-02", "2026-03-08", noHolidays)).toBe(
      countWorkingDaysInRange("2026-03-02", "2026-03-08", holidays)
    );
  });
});

describe("calculateEffectiveGross", () => {
  const noHolidays = new Set<string>();

  it("returns 0 for no contracts", () => {
    const result = calculateEffectiveGross([], "2026-03-01", "2026-03-31", 22, noHolidays);
    expect(result).toEqual({ grossSalary: 0, contractId: null });
  });

  it("returns full salary for single contract", () => {
    const contracts: ContractRow[] = [
      { id: "c1", gross_salary: 3000, effective_from: "2026-01-01", effective_to: null },
    ];
    const result = calculateEffectiveGross(contracts, "2026-03-01", "2026-03-31", 22, noHolidays);
    expect(result).toEqual({ grossSalary: 3000, contractId: "c1" });
  });

  it("prorates mid-month salary raise by working days", () => {
    // Old contract: $2000, effective until March 15 (Sun)
    // New contract: $3000, effective from March 16 (Mon)
    // March 2026: 22 working days total
    // Mar 1-15: 2026-03-01 (Sun) to 2026-03-15 (Sun) → weekdays: Mon 2 to Fri 13 = 10 working days
    // Mar 16-31: 2026-03-16 (Mon) to 2026-03-31 (Tue) → 12 working days
    const contracts: ContractRow[] = [
      { id: "c2", gross_salary: 3000, effective_from: "2026-03-16", effective_to: null },
      { id: "c1", gross_salary: 2000, effective_from: "2026-01-01", effective_to: "2026-03-15" },
    ];
    const result = calculateEffectiveGross(contracts, "2026-03-01", "2026-03-31", 22, noHolidays);
    // (2000 * 10/22) + (3000 * 12/22) = 909.09 + 1636.36 = 2545.45
    expect(result.grossSalary).toBeCloseTo(2545.45, 2);
    expect(result.contractId).toBe("c2");
  });

  it("handles contract starting mid-month with holidays", () => {
    // 2 holidays in the first half reduce that segment's weight
    const holidays = new Set(["2026-03-03", "2026-03-05"]); // Tue, Thu
    const contracts: ContractRow[] = [
      { id: "c2", gross_salary: 4000, effective_from: "2026-03-16", effective_to: null },
      { id: "c1", gross_salary: 2000, effective_from: "2026-01-01", effective_to: "2026-03-15" },
    ];
    // Total working days with holidays: 22 - 2 = 20
    // Mar 1-15 working days: 10 - 2 = 8
    // Mar 16-31 working days: 12
    const result = calculateEffectiveGross(contracts, "2026-03-01", "2026-03-31", 20, holidays);
    // (2000 * 8/20) + (4000 * 12/20) = 800 + 2400 = 3200
    expect(result.grossSalary).toBe(3200);
    expect(result.contractId).toBe("c2");
  });

  it("handles contract covering only part of the period", () => {
    // Employee hired mid-month, single contract
    const contracts: ContractRow[] = [
      { id: "c1", gross_salary: 5000, effective_from: "2026-03-16", effective_to: null },
    ];
    // Single contract → returns full salary (proration happens elsewhere)
    const result = calculateEffectiveGross(contracts, "2026-03-01", "2026-03-31", 22, noHolidays);
    expect(result.grossSalary).toBe(5000);
  });

  it("handles open-ended contract (no effective_to)", () => {
    const contracts: ContractRow[] = [
      { id: "c2", gross_salary: 3500, effective_from: "2026-03-10", effective_to: null },
      { id: "c1", gross_salary: 3000, effective_from: "2026-01-01", effective_to: "2026-03-09" },
    ];
    // Mar 1-9: 7 working days (Mon 2 to Fri 6 = 5, Mon 9 = 1... wait let me recalc)
    // Mar 1 Sun, Mar 2 Mon..Mar 6 Fri = 5, Mar 9 Mon = 1 → 6 working days
    // Mar 10-31: 22 - 6 = 16 working days
    const result = calculateEffectiveGross(contracts, "2026-03-01", "2026-03-31", 22, noHolidays);
    // (3000 * 6/22) + (3500 * 16/22) = 818.18 + 2545.45 = 3363.64
    expect(result.grossSalary).toBeCloseTo(3363.64, 2);
  });

  it("returns 0 grossSalary when totalWorkingDays is 0", () => {
    const contracts: ContractRow[] = [
      { id: "c2", gross_salary: 3000, effective_from: "2026-03-16", effective_to: null },
      { id: "c1", gross_salary: 2000, effective_from: "2026-01-01", effective_to: "2026-03-15" },
    ];
    const result = calculateEffectiveGross(contracts, "2026-03-01", "2026-03-31", 0, noHolidays);
    expect(result.grossSalary).toBe(0);
  });
});
