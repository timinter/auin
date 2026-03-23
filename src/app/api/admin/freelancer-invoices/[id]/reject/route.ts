import { requireRole } from "@/lib/auth";
import { rejectInvoiceSchema, uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = rejectInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const { data: invoice, error } = await serviceClient
      .from("freelancer_invoices")
      .update({ status: "rejected", rejection_reason: parsed.data.rejection_reason })
      .eq("id", params.id)
      .select("freelancer_id, total_amount, payroll_periods(year, month)")
      .single();

    if (error) return NextResponse.json({ error: "Failed to reject invoice" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "freelancer_invoice.reject",
      entityType: "freelancer_invoice",
      entityId: params.id,
      newValues: { status: "rejected", rejection_reason: parsed.data.rejection_reason },
    });

    if (invoice) {
      const pp = invoice.payroll_periods as unknown as { year: number; month: number } | null;
      const periodName = pp ? `${pp.year}-${String(pp.month).padStart(2, "0")}` : "Unknown period";
      await createNotification(serviceClient, {
        userId: invoice.freelancer_id,
        title: "Invoice Rejected",
        message: `Your invoice for ${periodName} ($${Number(invoice.total_amount).toFixed(2)}) was rejected. Reason: ${parsed.data.rejection_reason}`,
        type: "warning",
        link: "/freelancer/invoices",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
