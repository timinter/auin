import { isSubmissionPastDeadline, getSubmissionDeadline } from "../deadline";

describe("isSubmissionPastDeadline", () => {
  const marchPeriod = { year: 2026, month: 3, submission_deadline: null };

  it("returns false before the 5th of next month", () => {
    // April 4, 2026 — still within deadline
    const now = new Date(2026, 3, 4, 12, 0, 0);
    expect(isSubmissionPastDeadline(marchPeriod, now)).toBe(false);
  });

  it("returns false on the 5th of next month (within the day)", () => {
    // April 5, 2026 at noon — still within deadline (deadline is end of day)
    const now = new Date(2026, 3, 5, 12, 0, 0);
    expect(isSubmissionPastDeadline(marchPeriod, now)).toBe(false);
  });

  it("returns true after the 5th of next month", () => {
    // April 6, 2026 — past deadline
    const now = new Date(2026, 3, 6, 0, 0, 0);
    expect(isSubmissionPastDeadline(marchPeriod, now)).toBe(true);
  });

  it("returns true well past deadline", () => {
    // May 2026 — way past deadline
    const now = new Date(2026, 4, 1);
    expect(isSubmissionPastDeadline(marchPeriod, now)).toBe(true);
  });

  it("handles December period (deadline in January next year)", () => {
    const decPeriod = { year: 2025, month: 12, submission_deadline: null };
    // January 3, 2026 — before deadline
    expect(isSubmissionPastDeadline(decPeriod, new Date(2026, 0, 3))).toBe(false);
    // January 6, 2026 — after deadline
    expect(isSubmissionPastDeadline(decPeriod, new Date(2026, 0, 6))).toBe(true);
  });

  it("uses custom submission_deadline when provided", () => {
    const customPeriod = { year: 2026, month: 3, submission_deadline: "2026-04-10" };
    // April 9 — before custom deadline
    expect(isSubmissionPastDeadline(customPeriod, new Date(2026, 3, 9))).toBe(false);
    // April 11 — after custom deadline
    expect(isSubmissionPastDeadline(customPeriod, new Date(2026, 3, 11))).toBe(true);
  });
});

describe("getSubmissionDeadline", () => {
  it("returns 5th of next month by default", () => {
    const deadline = getSubmissionDeadline({ year: 2026, month: 3, submission_deadline: null });
    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(3); // April (0-indexed)
    expect(deadline.getDate()).toBe(5);
  });

  it("returns custom deadline when provided", () => {
    const deadline = getSubmissionDeadline({ year: 2026, month: 3, submission_deadline: "2026-04-10" });
    expect(deadline.getDate()).toBe(10);
  });

  it("handles year rollover for December", () => {
    const deadline = getSubmissionDeadline({ year: 2025, month: 12, submission_deadline: null });
    expect(deadline.getFullYear()).toBe(2026);
    expect(deadline.getMonth()).toBe(0); // January
    expect(deadline.getDate()).toBe(5);
  });
});
