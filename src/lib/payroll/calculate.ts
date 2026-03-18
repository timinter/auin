/**
 * Shared payroll calculation logic used by single update, batch update, and generation routes.
 */

export interface PayrollFields {
  days_worked: number;
  gross_salary: number;
  bonus: number;
  compensation_amount: number;
}

/**
 * Calculate prorated gross and total amount for a payroll record.
 */
export function calculatePayrollTotal(
  existing: PayrollFields & { period?: { working_days: number } | null },
  updates: Partial<PayrollFields>
): { proratedGross: number; totalAmount: number } {
  const daysWorked = updates.days_worked ?? existing.days_worked;
  const workingDays = existing.period?.working_days || 1;
  const grossSalary = existing.gross_salary;
  const proratedGross = Math.round((grossSalary / workingDays) * daysWorked * 100) / 100;

  const totalAmount = Math.round((
    proratedGross +
    (updates.bonus ?? existing.bonus) +
    (updates.compensation_amount ?? existing.compensation_amount)
  ) * 100) / 100;

  return { proratedGross, totalAmount };
}
