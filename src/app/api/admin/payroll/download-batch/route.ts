import { requireRole } from "@/lib/auth";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice";
import { MONTHS, formatDate, shortDate } from "@/lib/pdf/date-helpers";
import { uploadPdfToDrive } from "@/lib/gdrive/upload";
import type { InvoiceData } from "@/lib/pdf/invoice-template";
import { NextResponse } from "next/server";
import JSZip from "jszip";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const { recordIds } = await request.json();
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ error: "No records selected" }, { status: 400 });
    }
    if (recordIds.length > 50) {
      return NextResponse.json({ error: "Maximum 50 records at once" }, { status: 400 });
    }

    // Fetch all records with employee and period data
    const { data: records } = await serviceClient
      .from("payroll_records")
      .select("*, employee:profiles(*), period:payroll_periods(*)")
      .in("id", recordIds)
      .eq("status", "approved");

    if (!records || records.length === 0) {
      return NextResponse.json({ error: "No approved records found" }, { status: 400 });
    }

    const zip = new JSZip();
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 5);

    for (const record of records) {
      const employee = record.employee;
      const period = record.period;
      const bank = employee?.bank_details || {};

      const lineItems: InvoiceData["lineItems"] = [];

      if (employee.service_description) {
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

      // Generate invoice number: prefix-seq or fallback
      let invoiceNumber: string | number = record.id.slice(0, 6).toUpperCase();
      if (employee.invoice_number_prefix) {
        const seq = employee.invoice_number_seq || 1;
        invoiceNumber = `${employee.invoice_number_prefix}-${String(seq).padStart(3, "0")}`;
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
      const filename = `${employee.last_name}_${MONTHS[period.month - 1]}_${period.year}.pdf`;
      zip.file(filename, pdfBuffer);

      // Upload each PDF to Drive (fire-and-forget)
      uploadPdfToDrive(pdfBuffer, filename, {
        year: period.year,
        month: period.month,
        entity: employee.entity || "US",
      }).then((driveResult) => {
        if (driveResult) {
          serviceClient
            .from("payroll_records")
            .update({ invoice_drive_file_id: driveResult.fileId })
            .eq("id", record.id);
        }
      }).catch((err) => console.error("Drive upload error:", err));
    }

    // Mark records as downloaded
    await serviceClient
      .from("payroll_records")
      .update({ downloaded_at: new Date().toISOString() })
      .in("id", records.map((r) => r.id))
      .is("downloaded_at", null);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const period = records[0].period;
    const zipFilename = `payroll_${MONTHS[period.month - 1]}_${period.year}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (err) {
    console.error("Batch PDF generation error:", err);
    return NextResponse.json({ error: "Failed to generate PDFs" }, { status: 500 });
  }
}
