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

    // Fetch all payment splits for these records
    const { data: allSplits } = await serviceClient
      .from("payroll_payment_splits")
      .select("*, bank_account:bank_accounts(*)")
      .in("payroll_record_id", records.map((r) => r.id));

    const splitsByRecord = new Map<string, typeof allSplits>();
    for (const s of (allSplits || [])) {
      const list = splitsByRecord.get(s.payroll_record_id) || [];
      list.push(s);
      splitsByRecord.set(s.payroll_record_id, list);
    }

    const zip = new JSZip();
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 5);

    for (const record of records) {
      const employee = record.employee;
      const period = record.period;
      const recordSplits = splitsByRecord.get(record.id) || [];

      const buildLineItems = (amount: number): InvoiceData["lineItems"] => {
        if (employee.service_description) {
          return [{ description: employee.service_description, amount }];
        }
        return [{ description: `Services for ${MONTHS[period.month - 1]} ${period.year}`, amount }];
      }

      const buildInvoice = (
        amount: number,
        bankInfo: { bank_name?: string; account_number?: string; swift?: string; iban?: string; bank_address?: string },
        invoiceNumber: string | number
      ): InvoiceData => {
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
          lineItems: buildLineItems(amount),
        };
      }

      let seq = employee.invoice_number_seq || 1;
      const prefix = employee.invoice_number_prefix;

      if (recordSplits.length > 1) {
        // Multiple splits → one PDF per split
        for (let i = 0; i < recordSplits.length; i++) {
          const split = recordSplits[i];
          const bankAccount = split.bank_account || {};
          const invoiceNumber = prefix
            ? `${prefix}-${String(seq).padStart(3, "0")}`
            : `${record.id.slice(0, 6).toUpperCase()}-${i + 1}`;

          const invoiceData = buildInvoice(split.amount, bankAccount, invoiceNumber);
          const pdfBuffer = await generateInvoicePdf(invoiceData);
          const label = (bankAccount.label || `Bank${i + 1}`).replace(/[^a-zA-Z0-9]/g, "_");
          const filename = `${employee.last_name}_${MONTHS[period.month - 1]}_${period.year}_${label}.pdf`;
          zip.file(filename, pdfBuffer);

          if (prefix) seq++;
        }
      } else {
        // Single split or no splits → single PDF
        const bankInfo = recordSplits.length === 1
          ? recordSplits[0].bank_account || employee.bank_details || {}
          : employee.bank_details || {};
        const amount = recordSplits.length === 1 ? recordSplits[0].amount : record.total_amount;

        const invoiceNumber = prefix
          ? `${prefix}-${String(seq).padStart(3, "0")}`
          : record.id.slice(0, 6).toUpperCase();

        const invoiceData = buildInvoice(amount, bankInfo, invoiceNumber);
        const pdfBuffer = await generateInvoicePdf(invoiceData);
        const filename = `${employee.last_name}_${MONTHS[period.month - 1]}_${period.year}.pdf`;
        zip.file(filename, pdfBuffer);

        // Upload to Drive (fire-and-forget)
        uploadPdfToDrive(pdfBuffer, filename, {
          year: period.year,
          month: period.month,
          entity: employee.entity || "US",
        }).catch((err) => console.error("Drive upload error:", err));

        if (prefix) seq++;
      }

      // Update invoice sequence
      if (prefix && seq !== (employee.invoice_number_seq || 1)) {
        await serviceClient.from("profiles").update({ invoice_number_seq: seq }).eq("id", employee.id);
      }
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
