import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    const { data: record } = await serviceClient
      .from("payroll_records")
      .select("status, employee_id, total_amount, payroll_periods(year, month)")
      .eq("id", params.id)
      .single();

    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (record.status !== "draft" && record.status !== "rejected") {
      return NextResponse.json({ error: "Can only send draft or rejected records" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("payroll_records")
      .update({ status: "pending_approval", rejection_reason: null })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to send payroll" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "payroll.send",
      entityType: "payroll_record",
      entityId: params.id,
      newValues: { status: "pending_approval" },
    });

    const pp = record.payroll_periods as unknown as { year: number; month: number } | null;
    const periodName = pp ? `${pp.year}-${String(pp.month).padStart(2, "0")}` : "Unknown period";
    await createNotification(serviceClient, {
      userId: record.employee_id,
      title: "Payroll Ready for Review",
      message: `Your payroll for ${periodName} ($${Number(record.total_amount).toFixed(2)}) has been sent for your approval.`,
      type: "action",
      link: "/employee/payroll",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
