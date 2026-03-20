/**
 * Check if a compensation submission is past the deadline.
 *
 * Default deadline: 5th of the month following the period.
 * e.g., March 2026 period → deadline is April 5, 2026.
 *
 * If a custom submission_deadline is set on the period, that takes precedence.
 */
export function isSubmissionPastDeadline(
  period: { year: number; month: number; submission_deadline: string | null },
  now: Date = new Date()
): boolean {
  if (period.submission_deadline) {
    return now > new Date(period.submission_deadline);
  }
  // Default: 5th of next month (month is 1-based in our data, Date month is 0-based)
  const deadline = new Date(period.year, period.month, 5, 23, 59, 59);
  return now > deadline;
}

/**
 * Get the deadline date for display purposes.
 */
export function getSubmissionDeadline(
  period: { year: number; month: number; submission_deadline: string | null }
): Date {
  if (period.submission_deadline) {
    return new Date(period.submission_deadline);
  }
  return new Date(period.year, period.month, 5, 23, 59, 59);
}
