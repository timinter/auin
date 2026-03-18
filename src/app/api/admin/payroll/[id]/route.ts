import { requireRole } from "@/lib/auth";
import { updatePayrollSchema, uuidParam } from "@/lib/validations";
import { calculatePayrollTotal } from "@/lib/payroll/calculate";
import { createAuditLog } from "@/lib/audit";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updatePayrollSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Get existing record with period info
    const { data: existing } = await serviceClient
      .from("payroll_records")
      .select("*, period:payroll_periods(*)")
      .eq("id", params.id)
      .single();

    if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

    const updates = parsed.data;
    const { proratedGross, totalAmount } = calculatePayrollTotal(existing, updates);

    const { data, error } = await serviceClient
      .from("payroll_records")
      .update({
        ...updates,
        prorated_gross: proratedGross,
        total_amount: totalAmount,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to update payroll record" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "payroll.update",
      entityType: "payroll_record",
      entityId: params.id,
      oldValues: { total_amount: existing.total_amount },
      newValues: { total_amount: totalAmount },
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
