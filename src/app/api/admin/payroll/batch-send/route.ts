import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    for (const id of ids) {
      if (!uuidParam.safeParse(id).success) {
        return NextResponse.json({ error: `Invalid payroll ID: ${id}` }, { status: 400 });
      }
    }

    const { data: records } = await serviceClient
      .from("payroll_records")
      .select("id, status, employee_id, total_amount, payroll_periods(year, month)")
      .in("id", ids);

    if (!records) {
      return NextResponse.json({ error: "Failed to fetch payroll records" }, { status: 400 });
    }

    const validRecords = records.filter(
      (r) => r.status === "draft" || r.status === "rejected"
    );
    const skipped = ids.length - validRecords.length;

    if (validRecords.length > 0) {
      const validIds = validRecords.map((r) => r.id);

      const { error } = await serviceClient
        .from("payroll_records")
        .update({ status: "pending_approval", rejection_reason: null })
        .in("id", validIds);

      if (error) {
        return NextResponse.json({ error: "Failed to send payroll records" }, { status: 400 });
      }

      for (const record of validRecords) {
        await createAuditLog(serviceClient, {
          userId: user.id,
          action: "payroll.send",
          entityType: "payroll_record",
          entityId: record.id,
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
      }
    }

    return NextResponse.json({ sent: validRecords.length, skipped });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
