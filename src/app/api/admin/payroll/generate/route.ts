import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { generatePayrollSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { calculateEffectiveGross, type ContractRow } from "@/lib/payroll-calc";
import { NextResponse } from "next/server";

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

    // Batch: fetch existing records, contracts, and holidays in parallel
    const [existingResult, contractsResult, holidaysResult, leavesResult] = await Promise.all([
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
      serviceClient
        .from("corporate_holidays")
        .select("date")
        .gte("date", periodStart)
        .lte("date", periodEnd),
      serviceClient
        .from("leave_requests")
        .select("employee_id, days_count")
        .in("employee_id", employeeIds)
        .eq("period_id", period_id)
        .eq("status", "approved"),
    ]);

    const holidaySet = new Set(
      (holidaysResult.data || []).map((h: { date: string }) => h.date)
    );

    // Aggregate approved leave days per employee
    const leaveDaysByEmployee = new Map<string, number>();
    for (const l of (leavesResult.data || [])) {
      const current = leaveDaysByEmployee.get(l.employee_id) || 0;
      leaveDaysByEmployee.set(l.employee_id, current + l.days_count);
    }

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
        periodEnd,
        period.working_days,
        holidaySet
      );

      if (grossSalary === 0) {
        skippedNoContract.push(emp.id);
        continue;
      }

      const leaveDays = leaveDaysByEmployee.get(emp.id) || 0;
      const daysWorked = Math.max(0, period.working_days - leaveDays);
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
