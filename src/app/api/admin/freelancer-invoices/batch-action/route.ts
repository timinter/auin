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
    const { ids, action, rejection_reason } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    if (action === "reject" && (!rejection_reason || typeof rejection_reason !== "string")) {
      return NextResponse.json({ error: "rejection_reason is required for reject action" }, { status: 400 });
    }

    for (const id of ids) {
      if (!uuidParam.safeParse(id).success) {
        return NextResponse.json({ error: `Invalid invoice ID: ${id}` }, { status: 400 });
      }
    }

    const { data: invoices } = await serviceClient
      .from("freelancer_invoices")
      .select("id, status, freelancer_id, total_amount, payroll_periods(year, month)")
      .in("id", ids);

    if (!invoices) {
      return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 400 });
    }

    const validInvoices = invoices.filter((inv) => inv.status === "pending_approval");
    const skipped = ids.length - validInvoices.length;

    if (validInvoices.length > 0) {
      const validIds = validInvoices.map((inv) => inv.id);

      const updateData =
        action === "approve"
          ? { status: "approved" }
          : { status: "rejected", rejection_reason };

      const { error } = await serviceClient
        .from("freelancer_invoices")
        .update(updateData)
        .in("id", validIds);

      if (error) {
        return NextResponse.json({ error: `Failed to ${action} invoices` }, { status: 400 });
      }

      for (const invoice of validInvoices) {
        if (action === "approve") {
          await createAuditLog(serviceClient, {
            userId: user.id,
            action: "freelancer_invoice.approve",
            entityType: "freelancer_invoice",
            entityId: invoice.id,
            newValues: { status: "approved" },
          });

          const ppA = invoice.payroll_periods as unknown as { year: number; month: number } | null;
          const periodNameA = ppA ? `${ppA.year}-${String(ppA.month).padStart(2, "0")}` : "Unknown period";
          await createNotification(serviceClient, {
            userId: invoice.freelancer_id,
            title: "Invoice Approved",
            message: `Your invoice for ${periodNameA} ($${Number(invoice.total_amount).toFixed(2)}) has been approved.`,
            type: "success",
            link: "/freelancer/invoices",
          });
        } else {
          await createAuditLog(serviceClient, {
            userId: user.id,
            action: "freelancer_invoice.reject",
            entityType: "freelancer_invoice",
            entityId: invoice.id,
            newValues: { status: "rejected", rejection_reason },
          });

          const ppR = invoice.payroll_periods as unknown as { year: number; month: number } | null;
          const periodNameR = ppR ? `${ppR.year}-${String(ppR.month).padStart(2, "0")}` : "Unknown period";
          await createNotification(serviceClient, {
            userId: invoice.freelancer_id,
            title: "Invoice Rejected",
            message: `Your invoice for ${periodNameR} ($${Number(invoice.total_amount).toFixed(2)}) was rejected. Reason: ${rejection_reason}`,
            type: "warning",
            link: "/freelancer/invoices",
          });
        }
      }
    }

    return NextResponse.json({ updated: validInvoices.length, skipped });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
