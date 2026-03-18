import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { generatePayrollSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

interface ContractRow {
  id: string;
  gross_salary: number;
  effective_from: string;
  effective_to: string | null;
}

/**
 * Calculate the effective gross salary for a period, handling mid-month
 * salary changes by prorating across overlapping contract segments.
 */
function calculateEffectiveGross(
  contracts: ContractRow[],
  periodStart: string,
  periodEnd: string
): { grossSalary: number; contractId: string | null } {
  if (contracts.length === 0) {
    return { grossSalary: 0, contractId: null };
  }

  // Single contract — simple case
  if (contracts.length === 1) {
    return { grossSalary: contracts[0].gross_salary, contractId: contracts[0].id };
  }

  // Multiple contracts overlap with the period — weighted proration by calendar days
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  const totalCalendarDays = Math.round((pEnd.getTime() - pStart.getTime()) / (86400000)) + 1;

  let weightedTotal = 0;

  for (const contract of contracts) {
    const cStart = new Date(contract.effective_from);
    const cEnd = contract.effective_to ? new Date(contract.effective_to) : pEnd;

    const overlapStart = cStart > pStart ? cStart : pStart;
    const overlapEnd = cEnd < pEnd ? cEnd : pEnd;
    const overlapDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;

    if (overlapDays > 0) {
      weightedTotal += contract.gross_salary * (overlapDays / totalCalendarDays);
    }
  }

  // Most recent contract is the "primary" for reference
  return {
    grossSalary: Math.round(weightedTotal * 100) / 100,
    contractId: contracts[0].id,
  };
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = generatePayrollSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }
    const { period_id, entity } = parsed.data;

    // Get period
    const { data: period } = await serviceClient.from("payroll_periods").select("*").eq("id", period_id).single();
    if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });
    if (period.status === "locked") return NextResponse.json({ error: "Period is locked" }, { status: 400 });

    // Get active employees for the selected entity
    const { data: employees } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("role", "employee")
      .eq("status", "active")
      .eq("entity", entity);

    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: "No active employees found" }, { status: 400 });
    }

    const periodStart = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
    const periodEndDate = new Date(period.year, period.month, 0);
    const periodEnd = periodEndDate.toISOString().split("T")[0];

    const employeeIds = employees.map((e) => e.id);

    // Batch: fetch existing records and all contracts in 2 queries instead of 2N
    const [existingResult, contractsResult] = await Promise.all([
      serviceClient
        .from("payroll_records")
        .select("employee_id")
        .eq("period_id", period_id)
        .in("employee_id", employeeIds),
      serviceClient
        .from("employee_contracts")
        .select("id, employee_id, gross_salary, effective_from, effective_to")
        .in("employee_id", employeeIds)
        .lte("effective_from", periodEnd)
        .or(`effective_to.is.null,effective_to.gte.${periodStart}`)
        .is("terminated_at", null)
        .order("effective_from", { ascending: false }),
    ]);

    const existingEmployeeIds = new Set(
      (existingResult.data || []).map((r) => r.employee_id)
    );

    // Group contracts by employee_id
    const contractsByEmployee = new Map<string, ContractRow[]>();
    for (const c of (contractsResult.data || [])) {
      const list = contractsByEmployee.get(c.employee_id) || [];
      list.push(c as ContractRow);
      contractsByEmployee.set(c.employee_id, list);
    }

    const records = [];
    const skippedNoContract: string[] = [];
    for (const emp of employees) {
      if (existingEmployeeIds.has(emp.id)) continue;

      const empContracts = contractsByEmployee.get(emp.id) || [];
      const { grossSalary, contractId } = calculateEffectiveGross(
        empContracts,
        periodStart,
        periodEnd
      );

      if (grossSalary === 0) {
        skippedNoContract.push(emp.id);
        continue;
      }

      const daysWorked = period.working_days;
      const proratedGross = (grossSalary / period.working_days) * daysWorked;

      records.push({
        period_id,
        employee_id: emp.id,
        contract_id: contractId,
        days_worked: daysWorked,
        gross_salary: Math.round(grossSalary * 100) / 100,
        prorated_gross: Math.round(proratedGross * 100) / 100,
        total_amount: Math.round(proratedGross * 100) / 100,
        status: "draft",
      });
    }

    if (records.length > 0) {
      const { error } = await serviceClient.from("payroll_records").insert(records);
      if (error) return NextResponse.json({ error: "Failed to generate payroll records" }, { status: 400 });
    }

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "payroll.generate",
      entityType: "payroll_period",
      entityId: period_id,
      newValues: { count: records.length, entity, skippedNoContract: skippedNoContract.length },
    });

    return NextResponse.json({
      count: records.length,
      skippedNoContract: skippedNoContract.length,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
