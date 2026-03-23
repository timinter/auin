import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    const { data: record } = await serviceClient
      .from("payroll_records")
      .select("*, payroll_periods(year, month)")
      .eq("id", params.id)
      .single();

    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (record.employee_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (record.status !== "pending_approval") return NextResponse.json({ error: "Not pending approval" }, { status: 400 });

    // Check profile completeness before allowing approval
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("personal_email, legal_address, bank_details")
      .eq("id", user.id)
      .single();

    if (profile) {
      const missing: string[] = [];
      if (!profile.personal_email) missing.push("Personal Email");
      if (!profile.legal_address) missing.push("Legal Address");
      const bank = profile.bank_details || {};
      if (!bank.bank_name) missing.push("Bank Name");
      if (!bank.account_number) missing.push("Account Number");
      if (!bank.swift) missing.push("SWIFT");
      if (!bank.iban) missing.push("IBAN");
      if (!bank.bank_address) missing.push("Bank Address");
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Please fill in your profile before approving: ${missing.join(", ")}`, missing },
          { status: 400 }
        );
      }
    }

    const { error } = await serviceClient
      .from("payroll_records")
      .update({ status: "approved" })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to approve payroll" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "payroll.approve",
      entityType: "payroll_record",
      entityId: params.id,
      newValues: { status: "approved" },
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
        title: "Payroll Approved",
        message: `${empName} (${empProfile?.email || "no email"}) approved their payroll for ${periodName}. Total: $${Number(record.total_amount).toFixed(2)}`,
        type: "success",
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
