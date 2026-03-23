export interface ContractRow {
  id: string;
  gross_salary: number;
  effective_from: string;
  effective_to: string | null;
}

/**
 * Count working days (Mon–Fri, excluding holidays) in a date range.
 */
export function countWorkingDaysInRange(
  startStr: string,
  endStr: string,
  holidaySet: Set<string>
): number {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const ds = `${y}-${m}-${day}`;
      if (!holidaySet.has(ds)) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Calculate the effective gross salary for a period, handling mid-month
 * salary changes by prorating across overlapping contract segments
 * using actual working days (not calendar days).
 */
export function calculateEffectiveGross(
  contracts: ContractRow[],
  periodStart: string,
  periodEnd: string,
  totalWorkingDays: number,
  holidaySet: Set<string>
): { grossSalary: number; contractId: string | null } {
  if (contracts.length === 0) {
    return { grossSalary: 0, contractId: null };
  }

  // Single contract — simple case
  if (contracts.length === 1) {
    return { grossSalary: contracts[0].gross_salary, contractId: contracts[0].id };
  }

  // Multiple contracts overlap with the period — weighted proration by working days
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  let weightedTotal = 0;

  for (const contract of contracts) {
    const cStart = new Date(contract.effective_from);
    const cEnd = contract.effective_to ? new Date(contract.effective_to) : pEnd;

    const overlapStart = cStart > pStart ? cStart : pStart;
    const overlapEnd = cEnd < pEnd ? cEnd : pEnd;

    if (overlapStart <= overlapEnd) {
      const fmtDate = (dt: Date) => {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const segmentWorkingDays = countWorkingDaysInRange(
        fmtDate(overlapStart),
        fmtDate(overlapEnd),
        holidaySet
      );
      if (segmentWorkingDays > 0 && totalWorkingDays > 0) {
        weightedTotal += contract.gross_salary * (segmentWorkingDays / totalWorkingDays);
      }
    }
  }

  // Most recent contract is the "primary" for reference
  return {
    grossSalary: Math.round(weightedTotal * 100) / 100,
    contractId: contracts[0].id,
  };
}
