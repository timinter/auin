import { calculateWorkingDays } from "../working-days";

describe("calculateWorkingDays", () => {
  it("calculates working days for a standard month (no holidays)", () => {
    // March 2026: starts on Sunday, 31 days
    // Weekdays: Mon-Fri x 4 full weeks + Tue-Fri of last partial = 22
    const result = calculateWorkingDays(2026, 3);
    expect(result).toBe(22);
  });

  it("subtracts corporate holidays on weekdays", () => {
    // March 2026, 22 working days minus 1 holiday
    const result = calculateWorkingDays(2026, 3, ["2026-03-09"]); // Monday
    expect(result).toBe(21);
  });

  it("does not subtract holidays on weekends", () => {
    // March 2026, holiday on Saturday — should not affect count
    const result = calculateWorkingDays(2026, 3, ["2026-03-07"]); // Saturday
    expect(result).toBe(22);
  });

  it("handles multiple holidays", () => {
    const holidays = ["2026-03-09", "2026-03-10", "2026-03-11"]; // Mon, Tue, Wed
    const result = calculateWorkingDays(2026, 3, holidays);
    expect(result).toBe(19);
  });

  it("handles February in non-leap year", () => {
    // Feb 2026: 28 days, starts on Sunday
    // 20 working days
    const result = calculateWorkingDays(2026, 2);
    expect(result).toBe(20);
  });

  it("handles February in leap year", () => {
    // Feb 2028: 29 days, starts on Tuesday
    // 21 working days
    const result = calculateWorkingDays(2028, 2);
    expect(result).toBe(21);
  });

  it("returns correct days for a month with holiday on Feb 23 (Belarus)", () => {
    // Feb 2026: 20 working days, minus Feb 23 which is Monday = 19
    const result = calculateWorkingDays(2026, 2, ["2026-02-23"]);
    expect(result).toBe(19);
  });

  it("handles empty holidays array", () => {
    const result = calculateWorkingDays(2026, 1, []);
    // January 2026: starts on Thursday, 31 days = 22 working days
    expect(result).toBe(22);
  });
});
