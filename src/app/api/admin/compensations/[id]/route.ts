import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { calculateCompensation } from "@/lib/compensation/calculate";
import { countWorkingDaysInRange } from "@/lib/payroll-calc";
import { NextResponse } from "next/server";
import { z } from "zod";

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  approved_amount: z.number().nonnegative().max(99_999).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid compensation ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { data: comp } = await serviceClient
      .from("employee_compensations")
      .select("*, compensation_categories(*), profiles!employee_compensations_employee_id_fkey(first_name, last_name, tax_rate)")
      .eq("id", params.id)
      .single();
    if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
    };

    if (parsed.data.status === "approved") {
      let approvedAmount = parsed.data.approved_amount;

      // If no explicit amount, auto-calculate
      if (approvedAmount == null) {
        try {
          const category = comp.compensation_categories as unknown as {
            name: string; limit_percentage: number | null;
            max_gross: number | null; annual_max_gross: number | null; is_prorated: boolean;
          };
          const employee = comp.profiles as unknown as { tax_rate: number } | null;
          const taxRate = employee?.tax_rate ?? 0.13;

          let exchangeRate: number | null = null;
          if (comp.submitted_currency !== "USD") {
            const { data: rate } = await serviceClient
              .from("exchange_rates").select("rate")
              .eq("period_id", comp.period_id).eq("from_currency", "BYN").eq("to_currency", "USD")
              .single();
            exchangeRate = rate?.rate ?? null;
          }

          let yearToDateApproved = 0;
          if (category.annual_max_gross != null) {
            const { data: period } = await serviceClient
              .from("payroll_periods").select("year").eq("id", comp.period_id).single();
            if (period) {
              const { data: yearPeriods } = await serviceClient
                .from("payroll_periods").select("id").eq("year", period.year);
              const periodIds = (yearPeriods || []).map((p) => p.id);
              if (periodIds.length > 0) {
                const { data: yearComps } = await serviceClient
                  .from("employee_compensations").select("approved_amount")
                  .eq("employee_id", comp.employee_id).eq("category_id", comp.category_id)
                  .eq("status", "approved").in("period_id", periodIds).neq("id", comp.id);
                yearToDateApproved = (yearComps || []).reduce((s, c) => s + (c.approved_amount || 0), 0);
              }
            }
          }

          const result = calculateCompensation({
            submittedAmount: comp.submitted_amount,
            submittedCurrency: comp.submitted_currency,
            exchangeRate,
            category,
            taxRate,
            yearToDateApproved,
          });
          approvedAmount = result.approvedGross;
        } catch (err) {
          console.error(err);
          approvedAmount = comp.submitted_amount;
        }
      }

      updateData.approved_amount = approvedAmount;
      updateData.approved_at = new Date().toISOString();
    }

    const { data, error } = await serviceClient
      .from("employee_compensations")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to update compensation" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: `compensation.${parsed.data.status}`,
      entityType: "employee_compensation",
      entityId: params.id,
      oldValues: { status: comp.status, approved_amount: comp.approved_amount },
      newValues: updateData,
    });

    const cat = comp.compensation_categories as unknown as { name: string } | null;
    const catName = cat?.name || "compensation";
    const amt = parsed.data.status === "approved"
      ? `$${Number(parsed.data.approved_amount ?? comp.submitted_amount).toFixed(2)}`
      : `$${Number(comp.submitted_amount).toFixed(2)}`;
    // Recalculate total approved compensations and update payroll record
    const { data: allComps } = await serviceClient
      .from("employee_compensations")
      .select("approved_amount")
      .eq("employee_id", comp.employee_id)
      .eq("period_id", comp.period_id)
      .eq("status", "approved");

    const totalCompensation = (allComps || []).reduce(
      (sum, c) => sum + (c.approved_amount || 0), 0
    );

    // Update the payroll record's compensation_amount
    const { data: payrollRecord } = await serviceClient
      .from("payroll_records")
      .select("id, gross_salary, days_worked, bonus, compensation_amount, adjustment_amount, period:payroll_periods(working_days)")
      .eq("employee_id", comp.employee_id)
      .eq("period_id", comp.period_id)
      .single();

    if (payrollRecord) {
      // Compute actual working days from calendar (minus holidays)
      const periodData = payrollRecord.period as unknown as { year: number; month: number; working_days: number } | null;
      let workingDays = periodData?.working_days || 1;
      if (periodData) {
        const pStart = `${periodData.year}-${String(periodData.month).padStart(2, "0")}-01`;
        const lastDay = new Date(periodData.year, periodData.month, 0).getDate();
        const pEnd = `${periodData.year}-${String(periodData.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const { data: holidays } = await serviceClient
          .from("corporate_holidays")
          .select("date")
          .gte("date", pStart)
          .lte("date", pEnd);
        const holidaySet = new Set((holidays || []).map((h: { date: string }) => h.date));
        workingDays = countWorkingDaysInRange(pStart, pEnd, holidaySet);
      }
      const proratedGross = Math.round((payrollRecord.gross_salary / workingDays) * payrollRecord.days_worked * 100) / 100;
      const totalAmount = Math.round((proratedGross + payrollRecord.bonus + totalCompensation + (payrollRecord.adjustment_amount || 0)) * 100) / 100;

      await serviceClient
        .from("payroll_records")
        .update({ compensation_amount: totalCompensation, total_amount: totalAmount })
        .eq("id", payrollRecord.id);
    }

    await createNotification(serviceClient, {
      userId: comp.employee_id,
      title: `Compensation ${parsed.data.status === "approved" ? "Approved" : "Rejected"}`,
      message: parsed.data.status === "approved"
        ? `Your ${catName} request (${amt}) has been approved.`
        : `Your ${catName} request (${amt}) has been rejected.`,
      type: parsed.data.status === "approved" ? "success" : "warning",
      link: "/employee/compensations",
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
