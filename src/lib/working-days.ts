/**
 * Calculate working days in a month, excluding weekends and corporate holidays.
 *
 * @param year - Full year (e.g. 2026)
 * @param month - 1-based month (1 = January)
 * @param holidayDates - Array of date strings (YYYY-MM-DD) for corporate holidays
 * @returns Number of working days
 */
export function calculateWorkingDays(
  year: number,
  month: number,
  holidayDates: string[] = []
): number {
  const holidaySet = new Set(holidayDates);
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    // Skip corporate holidays
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (holidaySet.has(dateStr)) continue;
    workingDays++;
  }

  return workingDays;
}
