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
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const { data: invoice } = await serviceClient
      .from("freelancer_invoices")
      .select("status, freelancer_id, total_amount, payroll_periods(year, month)")
      .eq("id", params.id)
      .single();

    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (invoice.status !== "pending_approval") return NextResponse.json({ error: "Not pending" }, { status: 400 });

    const { error } = await serviceClient
      .from("freelancer_invoices")
      .update({ status: "approved" })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to approve invoice" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "freelancer_invoice.approve",
      entityType: "freelancer_invoice",
      entityId: params.id,
      newValues: { status: "approved" },
    });

    const pp = invoice.payroll_periods as unknown as { year: number; month: number } | null;
    const periodName = pp ? `${pp.year}-${String(pp.month).padStart(2, "0")}` : "Unknown period";
    await createNotification(serviceClient, {
      userId: invoice.freelancer_id,
      title: "Invoice Approved",
      message: `Your invoice for ${periodName} ($${Number(invoice.total_amount).toFixed(2)}) has been approved.`,
      type: "success",
      link: "/freelancer/invoices",
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
