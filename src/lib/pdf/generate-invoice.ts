import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, InvoiceData } from "./invoice-template";

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(InvoiceDocument, { data }) as any
  );
  return Buffer.from(buffer);
}
