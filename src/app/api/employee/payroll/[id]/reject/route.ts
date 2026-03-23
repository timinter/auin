import { requireRole } from "@/lib/auth";
import { rejectPayrollSchema, uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = rejectPayrollSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const { data: record } = await serviceClient
      .from("payroll_records")
      .select("*, payroll_periods(year, month)")
      .eq("id", params.id)
      .single();

    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (record.employee_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (record.status !== "pending_approval") return NextResponse.json({ error: "Not pending approval" }, { status: 400 });

    const { error } = await serviceClient
      .from("payroll_records")
      .update({ status: "rejected", rejection_reason: parsed.data.rejection_reason })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to reject payroll" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "payroll.reject",
      entityType: "payroll_record",
      entityId: params.id,
      newValues: { status: "rejected", rejection_reason: parsed.data.rejection_reason },
    });

    // Notify admins
    const { data: empProfile } = await serviceClient
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .single();
    const empName = empProfile ? `${empProfile.first_name} ${empProfile.last_name}` : "An employee";
    const pp = record.payroll_periods as unknown as { year: number; month: number } | null;
    const periodName = pp ? `${pp.year}-${String(pp.month).padStart(2, "0")}` : "Unknown period";

    const { data: admins } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("status", "active");
    if (admins && admins.length > 0) {
      await createNotifications(serviceClient, admins.map((a) => a.id), {
        title: "Payroll Rejected",
        message: `${empName} (${empProfile?.email || "no email"}) rejected their payroll for ${periodName}. Reason: ${parsed.data.rejection_reason}`,
        type: "warning",
        link: `/admin/payroll/${params.id}`,
        slackNotify: true,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
