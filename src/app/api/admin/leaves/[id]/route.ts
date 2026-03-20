import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { reviewLeaveSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = reviewLeaveSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Verify leave exists and is pending
    const { data: leave } = await serviceClient
      .from("leave_requests")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!leave) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    if (leave.status !== "pending") {
      return NextResponse.json({ error: "Leave request is not pending" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("leave_requests")
      .update({
        status: parsed.data.status,
        rejection_reason: parsed.data.status === "rejected" ? parsed.data.rejection_reason : null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select("*, employee:profiles!employee_id(*), period:payroll_periods(*)")
      .single();

    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: `leave.${parsed.data.status}`,
      entityType: "leave_request",
      entityId: params.id,
      oldValues: { status: "pending" },
      newValues: { status: parsed.data.status },
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { data: leave } = await serviceClient
      .from("leave_requests")
      .select("status")
      .eq("id", params.id)
      .single();

    if (!leave) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });

    const { error } = await serviceClient
      .from("leave_requests")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "leave.delete",
      entityType: "leave_request",
      entityId: params.id,
      oldValues: { status: leave.status },
      newValues: null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
