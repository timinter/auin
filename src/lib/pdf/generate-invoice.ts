import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument, InvoiceData } from "./invoice-template";

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoiceDocument, { data }) as any;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
