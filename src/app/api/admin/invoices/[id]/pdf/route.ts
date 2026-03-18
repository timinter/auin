import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice";
import { MONTHS, formatDate, shortDate } from "@/lib/pdf/date-helpers";
import { uploadPdfToDrive } from "@/lib/gdrive/upload";
import type { InvoiceData } from "@/lib/pdf/invoice-template";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    // Fetch invoice with freelancer, period, and lines
    const { data: invoice } = await serviceClient
      .from("freelancer_invoices")
      .select("*, freelancer:profiles(*), period:payroll_periods(*), lines:freelancer_invoice_lines(*, project:projects(*))")
      .eq("id", params.id)
      .single();

    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    const freelancer = invoice.freelancer;
    const period = invoice.period;
    const bank = freelancer?.bank_details || {};

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 5);

    const defaultDesc = freelancer.service_description || "Software development (revision) by the request of the Client and other services in the field of software.";
    const lineItems: InvoiceData["lineItems"] = (invoice.lines || []).map(
      (line: { line_type?: string; description?: string | null; project?: { name: string }; hours: number; hourly_rate: number; line_total: number }) => {
        if (line.line_type === "bonus") {
          return {
            description: line.description || "Bonus",
            amount: line.line_total,
          };
        }
        return {
          description: `${defaultDesc} — ${line.project?.name || "Project"}`,
          quantity: `${line.hours} hrs`,
          rate: `$ ${line.hourly_rate.toFixed(2)}`,
          amount: line.line_total,
        };
      }
    );

    if (lineItems.length === 0) {
      lineItems.push({
        description: defaultDesc,
        amount: invoice.total_amount,
      });
    }

    // Generate invoice number: prefix-seq or fallback to invoice ID
    let invoiceNumber: string | number = invoice.id.slice(0, 6).toUpperCase();
    if (freelancer.invoice_number_prefix) {
      const seq = freelancer.invoice_number_seq || 1;
      invoiceNumber = `${freelancer.invoice_number_prefix}-${String(seq).padStart(3, "0")}`;
      await serviceClient
        .from("profiles")
        .update({ invoice_number_seq: seq + 1 })
        .eq("id", freelancer.id);
    }

    const invoiceData: InvoiceData = {
      invoiceNumber,
      agreementDate: formatDate(now),
      invoiceDate: shortDate(now),
      dueDate: shortDate(dueDate),
      totalAmount: invoice.total_amount,
      entity: freelancer.entity || "US",
      supplier: {
        fullName: `${freelancer.first_name} ${freelancer.last_name}`,
        legalAddress: freelancer.legal_address || undefined,
        iban: bank.iban || undefined,
        bankAccount: bank.account_number || undefined,
        bankName: bank.bank_name || undefined,
        bankAddress: bank.bank_address || undefined,
        swift: bank.swift || undefined,
        email: freelancer.personal_email || freelancer.email,
      },
      lineItems,
    };

    const pdfBuffer = await generateInvoicePdf(invoiceData);

    const filename = `invoice_${freelancer.last_name}_${MONTHS[period.month - 1]}_${period.year}.pdf`;

    // Upload to Google Drive (fire-and-forget)
    uploadPdfToDrive(pdfBuffer, filename, {
      year: period.year,
      month: period.month,
      entity: freelancer.entity || "US",
    }).then((driveResult) => {
      if (driveResult) {
        serviceClient
          .from("freelancer_invoices")
          .update({ invoice_drive_file_id: driveResult.fileId })
          .eq("id", params.id);
      }
    }).catch((err) => console.error("Drive upload error:", err));

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
