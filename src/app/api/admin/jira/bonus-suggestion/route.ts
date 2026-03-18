import { requireRole } from "@/lib/auth";
import { calculateOvertimeBonus } from "@/lib/jira/bonus";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  employee_id: z.string().uuid(),
  period_id: z.string().uuid(),
});

/**
 * GET /api/admin/jira/bonus-suggestion?employee_id=...&period_id=...
 *
 * Fetches the employee's Jira worklogs for the period and calculates
 * a suggested overtime bonus based on hours logged vs working days.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      employee_id: url.searchParams.get("employee_id"),
      period_id: url.searchParams.get("period_id"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const { employee_id, period_id } = parsed.data;

    // Fetch employee profile and period in parallel
    const [profileResult, periodResult, recordResult] = await Promise.all([
      serviceClient.from("profiles").select("email, gross_salary:employee_contracts(gross_salary)").eq("id", employee_id).single(),
      serviceClient.from("payroll_periods").select("year, month, working_days").eq("id", period_id).single(),
      serviceClient.from("payroll_records").select("gross_salary").eq("employee_id", employee_id).eq("period_id", period_id).single(),
    ]);

    if (!profileResult.data || !periodResult.data) {
      return NextResponse.json({ error: "Employee or period not found" }, { status: 404 });
    }

    const period = periodResult.data;
    const grossSalary = recordResult.data?.gross_salary || 0;

    // Try to fetch Jira hours
    let totalHoursLogged = 0;
    let jiraAvailable = false;

    try {
      // Dynamic import to avoid errors if Jira is not configured
      const { fetchUserWorklogHours } = await import("@/lib/jira/client");
      const startDate = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
      const endDate = new Date(period.year, period.month, 0).toISOString().split("T")[0];

      const hours = await fetchUserWorklogHours(
        profileResult.data.email,
        startDate,
        endDate
      );

      if (hours !== null) {
        totalHoursLogged = hours;
        jiraAvailable = true;
      }
    } catch {
      // Jira not configured — return calculation with 0 hours
    }

    const result = calculateOvertimeBonus({
      totalHoursLogged,
      workingDays: period.working_days,
      grossSalary,
    });

    return NextResponse.json({
      jiraAvailable,
      totalHoursLogged,
      ...result,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
