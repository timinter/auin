import { requireRole } from "@/lib/auth";
import { updatePayrollSchema } from "@/lib/validations";
import { calculatePayrollTotal } from "@/lib/payroll/calculate";
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
    let updatedCount = 0;

    for (const update of parsed.data.updates) {
      const existing = recordMap.get(update.id);
      if (!existing) continue;

      const { id, ...fields } = update;
      const { proratedGross, totalAmount } = calculatePayrollTotal(existing, fields);

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
