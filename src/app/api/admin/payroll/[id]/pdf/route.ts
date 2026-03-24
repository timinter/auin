import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice";
import { MONTHS, formatDate, shortDate } from "@/lib/pdf/date-helpers";
import { uploadPdfToDrive } from "@/lib/gdrive/upload";
import type { InvoiceData } from "@/lib/pdf/invoice-template";
import { NextResponse } from "next/server";
import JSZip from "jszip";

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

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 5);

    // Check for payment splits
    const { data: splits } = await serviceClient
      .from("payroll_payment_splits")
      .select("*, bank_account:bank_accounts(*)")
      .eq("payroll_record_id", params.id);

    // Build invoice data for a given amount and bank details
    const buildInvoiceData = (
      amount: number,
      bankInfo: { bank_name?: string; account_number?: string; swift?: string; iban?: string; bank_address?: string },
      invoiceNumber: string | number
    ): InvoiceData => {
      const lineItems: InvoiceData["lineItems"] = [];

      if (employee.service_description) {
        lineItems.push({ description: employee.service_description, amount });
      } else {
        lineItems.push({
          description: `Services for ${MONTHS[period.month - 1]} ${period.year}`,
          amount,
        });
      }

      return {
        invoiceNumber,
        agreementDate: employee.contract_date ? formatDate(new Date(employee.contract_date)) : formatDate(now),
        invoiceDate: shortDate(now),
        dueDate: shortDate(dueDate),
        totalAmount: amount,
        entity: employee.entity || "US",
        supplier: {
          fullName: `${employee.first_name} ${employee.last_name}`,
          legalAddress: employee.legal_address || undefined,
          iban: bankInfo.iban || undefined,
          bankAccount: bankInfo.account_number || undefined,
          bankName: bankInfo.bank_name || undefined,
          bankAddress: bankInfo.bank_address || undefined,
          swift: bankInfo.swift || undefined,
          email: employee.personal_email || employee.email,
        },
        lineItems,
      };
    }

    // Generate invoice number — always "N{seq}" format, auto-increment
    let seq = employee.invoice_number_seq || 1;

    const hasSplits = splits && splits.length > 1;

    if (hasSplits) {
      // Multiple splits → generate one PDF per split, return as ZIP
      const zip = new JSZip();

      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        const bankAccount = split.bank_account || {};
        const invoiceNumber = `N${seq}`;

        const invoiceData = buildInvoiceData(split.amount, bankAccount, invoiceNumber);
        const pdfBuffer = await generateInvoicePdf(invoiceData);
        const label = (bankAccount.label || `Bank${i + 1}`).replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `${employee.last_name}_${MONTHS[period.month - 1]}_${period.year}_${label}.pdf`;
        zip.file(filename, pdfBuffer);
        seq++;
      }

      // Update invoice sequence
      await serviceClient.from("profiles").update({ invoice_number_seq: seq }).eq("id", employee.id);

      const zipBuffer = await zip.generateAsync({ type: "uint8array" });
      const zipFilename = `invoices_${employee.last_name}_${MONTHS[period.month - 1]}_${period.year}.zip`;

      // Mark as downloaded
      await serviceClient
        .from("payroll_records")
        .update({ downloaded_at: new Date().toISOString() })
        .eq("id", params.id)
        .is("downloaded_at", null);

      return new NextResponse(Buffer.from(zipBuffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFilename}"`,
        },
      });
    }

    // Single split or no splits → single PDF
    const bankInfo = splits && splits.length === 1
      ? splits[0].bank_account || employee.bank_details || {}
      : employee.bank_details || {};
    const amount = splits && splits.length === 1 ? splits[0].amount : record.total_amount;

    const invoiceNumber = `N${seq}`;
    await serviceClient.from("profiles").update({ invoice_number_seq: seq + 1 }).eq("id", employee.id);

    const invoiceData = buildInvoiceData(amount, bankInfo, invoiceNumber);
    const pdfBuffer = await generateInvoicePdf(invoiceData);
    const filename = `invoice_${employee.last_name}_${MONTHS[period.month - 1]}_${period.year}.pdf`;

    // Upload to Google Drive (fire-and-forget)
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

    // Mark as downloaded
    await serviceClient
      .from("payroll_records")
      .update({ downloaded_at: new Date().toISOString() })
      .eq("id", params.id)
      .is("downloaded_at", null);

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
