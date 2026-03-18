import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";
import { submitInvoiceSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("freelancer");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { data: profile } = await serviceClient.from("profiles").select("service_description, first_name, last_name, personal_email, legal_address, bank_details").eq("id", user.id).single();

    const body = await request.json();
    const parsed = submitInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }
    const { period_id, lines, bonus_lines, invoice_file_url, time_report_url, submit } = parsed.data;

    // Check profile completeness before allowing submission
    if (submit && profile) {
      const missing: string[] = [];
      if (!profile.service_description) missing.push("Service Description");
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
          { error: `Please fill in your profile before submitting: ${missing.join(", ")}`, missing },
          { status: 400 }
        );
      }
    }

    // TODO: re-enable time report requirement for production
    // if (submit && !time_report_url) {
    //   return NextResponse.json(
    //     { error: "Please upload a time report before submitting" },
    //     { status: 400 }
    //   );
    // }

    // Check submission deadline
    if (submit) {
      const { data: period } = await serviceClient
        .from("payroll_periods")
        .select("submission_deadline")
        .eq("id", period_id)
        .single();

      if (period?.submission_deadline) {
        const now = new Date();
        const deadline = new Date(period.submission_deadline + "T23:59:59");
        // Check if existing invoice has deadline override
        const { data: existingForDeadline } = await serviceClient
          .from("freelancer_invoices")
          .select("deadline_override")
          .eq("period_id", period_id)
          .eq("freelancer_id", user.id)
          .single();

        if (now > deadline && !existingForDeadline?.deadline_override) {
          return NextResponse.json(
            { error: `Submission deadline (${period.submission_deadline}) has passed. Contact admin for an extension.` },
            { status: 400 }
          );
        }
      }
    }

    // Check for existing invoice
    const { data: existing } = await serviceClient
      .from("freelancer_invoices")
      .select("id, status")
      .eq("period_id", period_id)
      .eq("freelancer_id", user.id)
      .single();

    if (existing && existing.status === "approved") {
      return NextResponse.json({ error: "Invoice already approved" }, { status: 400 });
    }

    if (existing && existing.status === "pending_approval") {
      return NextResponse.json({ error: "Invoice is pending approval" }, { status: 400 });
    }

    // Build project lines with rates
    const invoiceLines: Array<{
      project_id: string | null;
      hours: number;
      hourly_rate: number;
      line_total: number;
      line_type: string;
      description: string | null;
    }> = [];
    let totalAmount = 0;

    for (const line of lines) {
      const { data: rate } = await serviceClient
        .from("freelancer_project_rates")
        .select("hourly_rate")
        .eq("freelancer_id", user.id)
        .eq("project_id", line.project_id)
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .single();

      if (!rate) continue;

      const lineTotal = Math.round(line.hours * rate.hourly_rate * 100) / 100;
      totalAmount += lineTotal;

      invoiceLines.push({
        project_id: line.project_id,
        hours: line.hours,
        hourly_rate: rate.hourly_rate,
        line_total: lineTotal,
        line_type: "project",
        description: null,
      });
    }

    // Add bonus lines
    for (const bonus of bonus_lines) {
      totalAmount += bonus.amount;
      invoiceLines.push({
        project_id: null,
        hours: 0,
        hourly_rate: 0,
        line_total: bonus.amount,
        line_type: "bonus",
        description: bonus.description,
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;
    const status = submit ? "pending_approval" : "draft";

    let invoiceId: string;

    if (existing) {
      // Update existing
      invoiceId = existing.id;
      await serviceClient
        .from("freelancer_invoices")
        .update({
          total_amount: totalAmount,
          status,
          rejection_reason: null,
          invoice_file_url: invoice_file_url ?? undefined,
          time_report_url: time_report_url ?? undefined,
        })
        .eq("id", existing.id);

      // Delete old lines and insert new
      await serviceClient.from("freelancer_invoice_lines").delete().eq("invoice_id", existing.id);
    } else {
      // Create new
      const { data: inv, error } = await serviceClient
        .from("freelancer_invoices")
        .insert({
          period_id,
          freelancer_id: user.id,
          total_amount: totalAmount,
          status,
          invoice_file_url: invoice_file_url || null,
          time_report_url: time_report_url || null,
        })
        .select()
        .single();

      if (error || !inv) return NextResponse.json({ error: error?.message || "Failed" }, { status: 400 });
      invoiceId = inv.id;
    }

    // Insert lines
    if (invoiceLines.length > 0) {
      await serviceClient.from("freelancer_invoice_lines").insert(
        invoiceLines.map((l) => ({ ...l, invoice_id: invoiceId }))
      );
    }

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: submit ? "freelancer_invoice.submit" : "freelancer_invoice.save_draft",
      entityType: "freelancer_invoice",
      entityId: invoiceId,
      newValues: { total_amount: totalAmount, status, lines_count: invoiceLines.length },
    });

    // Notify admins when invoice is submitted
    if (submit) {
      const { data: admins } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .eq("status", "active");
      if (admins && admins.length > 0) {
        await createNotifications(serviceClient, admins.map((a) => a.id), {
          title: "New Invoice Submitted",
          message: `${profile?.first_name} ${profile?.last_name} (${profile?.personal_email || "no email"}) submitted an invoice for $${totalAmount.toFixed(2)}.`,
          type: "action",
          link: `/admin/freelancer-invoices/${invoiceId}`,
          slackNotify: true,
        });
      }
    }

    return NextResponse.json({ id: invoiceId, total_amount: totalAmount });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
