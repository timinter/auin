"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FreelancerInvoice, FreelancerInvoiceLine } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import Link from "next/link";
import { PageSpinner } from "@/components/spinner";

export default function FreelancerInvoiceDetailPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<FreelancerInvoice | null>(null);
  const [lines, setLines] = useState<FreelancerInvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: inv } = await supabase
        .from("freelancer_invoices")
        .select("*, period:payroll_periods(*)")
        .eq("id", params.id)
        .single();
      setInvoice(inv);

      const { data: l } = await supabase
        .from("freelancer_invoice_lines")
        .select("*, project:projects(*)")
        .eq("invoice_id", params.id);
      setLines(l || []);
      setLoading(false);
    }
    loadData();
  }, [params.id]);

  if (loading || !invoice) return <PageSpinner />;

  const statusVariant = () => {
    switch (invoice.status) {
      case "approved": return "success" as const;
      case "pending_approval": return "warning" as const;
      case "rejected": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Invoice Details</h1>
        <p className="text-muted-foreground">
          {invoice.period && formatPeriod(invoice.period.year, invoice.period.month)} &middot;{" "}
          <Badge variant={statusVariant()}>{invoice.status.replace("_", " ")}</Badge>
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Invoice Lines</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.project?.name}</TableCell>
                  <TableCell className="text-right">{line.hours}</TableCell>
                  <TableCell className="text-right">{formatCurrency(line.hourly_rate)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(line.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-semibold">Grand Total</TableCell>
                <TableCell className="text-right font-bold text-lg">{formatCurrency(invoice.total_amount)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {invoice.rejection_reason && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-medium">Rejection Reason:</p>
            <p className="text-sm">{invoice.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {(invoice.status === "draft" || invoice.status === "rejected") && (
        <Link href="/freelancer/invoices/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Edit & Re-submit
        </Link>
      )}

      {invoice.status === "approved" && invoice.invoice_file_url && (
        <a href={invoice.invoice_file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          View Invoice PDF
        </a>
      )}
    </div>
  );
}
