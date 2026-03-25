import { requireRole } from "@/lib/auth";
import { updatePayrollSchema } from "@/lib/validations";
import { calculatePayrollTotal } from "@/lib/payroll/calculate";
import { countWorkingDaysInRange } from "@/lib/payroll-calc";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const batchSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
    }).and(updatePayrollSchema)
  ).min(1).max(100),
});

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const recordIds = parsed.data.updates.map((u) => u.id);

    // Fetch all records with period info
    const { data: records } = await serviceClient
      .from("payroll_records")
      .select("*, period:payroll_periods(*)")
      .in("id", recordIds);

    if (!records) return NextResponse.json({ error: "Records not found" }, { status: 404 });

    const recordMap = new Map(records.map((r) => [r.id, r]));

    // Compute actual working days per period (records may span different periods)
    const workingDaysCache = new Map<string, number>();
    for (const record of records) {
      const period = record.period as { id: string; year: number; month: number } | null;
      if (!period || workingDaysCache.has(period.id)) continue;
      const pStart = `${period.year}-${String(period.month).padStart(2, "0")}-01`;
      const lastDay = new Date(period.year, period.month, 0).getDate();
      const pEnd = `${period.year}-${String(period.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const { data: holidays } = await serviceClient
        .from("corporate_holidays")
        .select("date")
        .gte("date", pStart)
        .lte("date", pEnd);
      const holidaySet = new Set((holidays || []).map((h: { date: string }) => h.date));
      workingDaysCache.set(period.id, countWorkingDaysInRange(pStart, pEnd, holidaySet));
    }

    let updatedCount = 0;

    for (const update of parsed.data.updates) {
      const existing = recordMap.get(update.id);
      if (!existing) continue;

      const periodId = (existing.period as { id: string } | null)?.id;
      const actualWorkingDays = periodId ? workingDaysCache.get(periodId) : undefined;

      const { id, ...fields } = update;
      const { proratedGross, totalAmount } = calculatePayrollTotal(existing, fields, actualWorkingDays);

      await serviceClient
        .from("payroll_records")
        .update({
          ...fields,
          prorated_gross: proratedGross,
          total_amount: totalAmount,
        })
        .eq("id", id);

      await createAuditLog(serviceClient, {
        userId: user.id,
        action: "payroll.batch_update",
        entityType: "payroll_record",
        entityId: id,
        oldValues: { total_amount: existing.total_amount },
        newValues: { total_amount: totalAmount },
      });

      updatedCount++;
    }

    return NextResponse.json({ updated: updatedCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
