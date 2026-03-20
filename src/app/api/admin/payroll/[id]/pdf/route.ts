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
      return NextResponse.json({ error: "Invalid payroll ID" }, { status: 400 });
    }

    // Fetch payroll record with employee and period
    const { data: record } = await serviceClient
      .from("payroll_records")
      .select("*, employee:profiles(*), period:payroll_periods(*)")
      .eq("id", params.id)
      .single();

    if (!record) return NextResponse.json({ error: "Record not found" }, { status: 404 });

    const employee = record.employee;
    const period = record.period;
    const bank = employee?.bank_details || {};

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 5);

    // Build line items from payroll breakdown
    const lineItems: InvoiceData["lineItems"] = [];

    if (employee.service_description) {
      // Single description line as per contract
      lineItems.push({
        description: employee.service_description,
        amount: record.total_amount,
      });
    } else {
      if (record.prorated_gross > 0) {
        lineItems.push({
          description: `Salary for ${MONTHS[period.month - 1]} ${period.year} (${record.days_worked}/${period.working_days} working days)`,
          amount: record.prorated_gross,
        });
      }

      if (record.bonus > 0) {
        lineItems.push({
          description: record.bonus_note ? `Bonus: ${record.bonus_note}` : "Bonus",
          amount: record.bonus,
        });
      }
      if (record.compensation_amount > 0) {
        lineItems.push({ description: "Compensation", amount: record.compensation_amount });
      }

      if (lineItems.length === 0) {
        lineItems.push({
          description: `Services for ${MONTHS[period.month - 1]} ${period.year}`,
          amount: record.total_amount,
        });
      }
    }

    // Generate invoice number: prefix-seq or fallback to record ID
    let invoiceNumber: string | number = record.id.slice(0, 6).toUpperCase();
    if (employee.invoice_number_prefix) {
      const seq = employee.invoice_number_seq || 1;
      invoiceNumber = `${employee.invoice_number_prefix}-${String(seq).padStart(3, "0")}`;
      // Increment the sequence for next time
      await serviceClient
        .from("profiles")
        .update({ invoice_number_seq: seq + 1 })
        .eq("id", employee.id);
    }

    const invoiceData: InvoiceData = {
      invoiceNumber,
      agreementDate: employee.contract_date ? formatDate(new Date(employee.contract_date)) : formatDate(now),
      invoiceDate: shortDate(now),
      dueDate: shortDate(dueDate),
      totalAmount: record.total_amount,
      entity: employee.entity || "US",
      supplier: {
        fullName: `${employee.first_name} ${employee.last_name}`,
        legalAddress: employee.legal_address || undefined,
        iban: bank.iban || undefined,
        bankAccount: bank.account_number || undefined,
        bankName: bank.bank_name || undefined,
        bankAddress: bank.bank_address || undefined,
        swift: bank.swift || undefined,
        email: employee.personal_email || employee.email,
      },
      lineItems,
    };

    const pdfBuffer = await generateInvoicePdf(invoiceData);

    const filename = `invoice_${employee.last_name}_${MONTHS[period.month - 1]}_${period.year}.pdf`;

    // Upload to Google Drive (fire-and-forget, don't block PDF response)
    uploadPdfToDrive(pdfBuffer, filename, {
      year: period.year,
      month: period.month,
      entity: employee.entity || "US",
    }).then((driveResult) => {
      if (driveResult) {
        serviceClient
          .from("payroll_records")
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
