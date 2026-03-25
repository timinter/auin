import { describe, it, expect } from "vitest";
import { mapLeaveType, countDaysInMonth } from "../leave-sync";

describe("PeopleForce Leave Sync", () => {
  describe("mapLeaveType", () => {
    it("maps Vacation (14100) to vacation", () => {
      expect(mapLeaveType(14100)).toBe("vacation");
    });

    it("maps Sick Leave (14102) to sick", () => {
      expect(mapLeaveType(14102)).toBe("sick");
    });

    it("maps Unpaid Leave (14718) to unpaid", () => {
      expect(mapLeaveType(14718)).toBe("unpaid");
    });

    it("maps Day Off (14101) to day_off", () => {
      expect(mapLeaveType(14101)).toBe("day_off");
    });

    it("returns null for Medical Insurance (14618)", () => {
      expect(mapLeaveType(14618)).toBeNull();
    });

    it("returns null for unknown type", () => {
      expect(mapLeaveType(99999)).toBeNull();
    });
  });

  describe("countDaysInMonth", () => {
    it("counts full leave within a month", () => {
      // March 2-6 2026 = Mon-Fri = 5 working days
      expect(countDaysInMonth("2026-03-02", "2026-03-06", 2026, 3)).toBe(5);
    });

    it("excludes weekends", () => {
      // March 2-8 2026 = Mon-Sun = 5 working days (Sat+Sun excluded)
      expect(countDaysInMonth("2026-03-02", "2026-03-08", 2026, 3)).toBe(5);
    });

    it("clamps leave that starts before the month", () => {
      // Leave Feb 25 - March 5, counting March only = March 2-5 = 4 working days (March 1 is Sun)
      expect(countDaysInMonth("2026-02-25", "2026-03-05", 2026, 3)).toBe(4);
    });

    it("clamps leave that ends after the month", () => {
      // Leave March 28 - April 5, counting March only = March 28 is Sat, 29 Sun, 30 Mon, 31 Tue = 2 working days
      expect(countDaysInMonth("2026-03-28", "2026-04-05", 2026, 3)).toBe(2);
    });

    it("returns 0 for leave entirely outside the month", () => {
      expect(countDaysInMonth("2026-02-01", "2026-02-15", 2026, 3)).toBe(0);
    });

    it("handles single day leave", () => {
      // March 3 2026 = Tuesday = 1 working day
      expect(countDaysInMonth("2026-03-03", "2026-03-03", 2026, 3)).toBe(1);
    });

    it("returns 0 for weekend-only leave", () => {
      // March 7-8 2026 = Sat-Sun
      expect(countDaysInMonth("2026-03-07", "2026-03-08", 2026, 3)).toBe(0);
    });

    it("handles month with 28 days (Feb non-leap)", () => {
      // Feb 23-28 2026 = Mon-Sat = 5 working days
      expect(countDaysInMonth("2026-02-23", "2026-02-28", 2026, 2)).toBe(5);
    });

    it("handles leave spanning entire month", () => {
      // March 2026: 22 working days (weekdays only)
      expect(countDaysInMonth("2026-03-01", "2026-03-31", 2026, 3)).toBe(22);
    });
  });
});
