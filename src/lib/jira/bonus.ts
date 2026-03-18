/**
 * Bonus auto-calculation from Jira logged hours.
 *
 * Rules:
 * - Delivery overtime: hours logged beyond the standard working days * 8 hours
 * - The overtime rate is configurable per employee (defaults to hourly equivalent of gross salary)
 *
 * This module provides the calculation logic.
 * The actual Jira data fetching is done by the client module.
 */

interface BonusCalculationInput {
  totalHoursLogged: number;
  workingDays: number;
  grossSalary: number;
}

interface BonusCalculationResult {
  standardHours: number;
  overtimeHours: number;
  hourlyRate: number;
  suggestedOvertimeBonus: number;
}

/**
 * Calculate suggested overtime bonus from Jira hours.
 *
 * Standard hours = workingDays * 8
 * Overtime hours = max(0, totalHoursLogged - standardHours)
 * Hourly rate = grossSalary / (workingDays * 8)
 * Overtime bonus = overtimeHours * hourlyRate
 */
export function calculateOvertimeBonus(
  input: BonusCalculationInput
): BonusCalculationResult {
  const standardHours = input.workingDays * 8;
  const overtimeHours = Math.max(0, input.totalHoursLogged - standardHours);
  const hourlyRate = standardHours > 0
    ? input.grossSalary / standardHours
    : 0;
  const suggestedOvertimeBonus = Math.round(overtimeHours * hourlyRate * 100) / 100;

  return {
    standardHours,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    suggestedOvertimeBonus,
  };
}
