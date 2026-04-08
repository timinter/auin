"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FreelancerInvoice, FreelancerInvoiceLine } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { PageSpinner, Spinner } from "@/components/spinner";
import { FileDown, Eye } from "lucide-react";

export default function FreelancerInvoiceDetailPage({ params }: { params: { id: string } }) {
  const [invoice, setInvoice] = useState<FreelancerInvoice | null>(null);
  const [lines, setLines] = useState<FreelancerInvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: inv } = await supabase
      .from("freelancer_invoices")
      .select("*, freelancer:profiles(*), period:payroll_periods(*)")
      .eq("id", params.id)
      .single();
    setInvoice(inv);

    const { data: l } = await supabase
      .from("freelancer_invoice_lines")
      .select("*, project:projects(*)")
      .eq("invoice_id", params.id);
    setLines(l || []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove() {
    const res = await fetch(`/api/admin/freelancer-invoices/${params.id}/approve`, { method: "POST" });
    if (res.ok) {
      toast({ title: "Invoice approved" });
      loadData();
    }
  }

  async function handleReject() {
    const res = await fetch(`/api/admin/freelancer-invoices/${params.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_reason: rejectReason }),
    });
    if (res.ok) {
      toast({ title: "Invoice rejected" });
      setRejecting(false);
      loadData();
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const res = await fetch(`/api/admin/invoices/${params.id}/pdf`);
      if (!res.ok) {
        toast({ title: "Error", description: "Failed to generate preview", variant: "destructive" });
        setPreviewOpen(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch {
      toast({ title: "Error", description: "Failed to load preview", variant: "destructive" });
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading || !invoice) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">{invoice.freelancer?.first_name} {invoice.freelancer?.last_name}</h1>
        <p className="text-muted-foreground">
          {invoice.period && formatPeriod(invoice.period.year, invoice.period.month)} &middot;{" "}
          <Badge variant={invoice.status === "approved" ? "success" : invoice.status === "rejected" ? "destructive" : invoice.status === "pending_approval" ? "warning" : "secondary"}>
            {invoice.status.replace("_", " ")}
          </Badge>
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
                  <TableCell>
                    {line.line_type === "bonus"
                      ? <span className="italic">{line.description || "Bonus"}</span>
                      : line.project?.name}
                  </TableCell>
                  <TableCell className="text-right">{line.line_type === "bonus" ? "—" : line.hours}</TableCell>
                  <TableCell className="text-right">{line.line_type === "bonus" ? "—" : formatCurrency(line.hourly_rate)}</TableCell>
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

      {(invoice.time_report_url || invoice.invoice_file_url) && (
        <Card>
          <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {invoice.time_report_url && (
              <a href={invoice.time_report_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                <FileDown className="h-4 w-4" /> Time Report
              </a>
            )}
            {invoice.invoice_file_url && (
              <a href={invoice.invoice_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                <FileDown className="h-4 w-4" /> Uploaded Invoice
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {invoice.rejection_reason && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-medium">Rejection Reason:</p>
            <p className="text-sm">{invoice.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      {invoice.status === "pending_approval" && (
        <div className="flex gap-4">
          <Button onClick={handleApprove}>Approve</Button>
          <Button variant="destructive" onClick={() => setRejecting(!rejecting)}>Reject</Button>
        </div>
      )}

      {invoice.status === "approved" && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-2" /> Preview PDF
          </Button>
          <Button variant="outline" onClick={async () => {
            const res = await fetch(`/api/admin/invoices/${params.id}/pdf`);
            if (!res.ok) {
              toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
              return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `invoice-${invoice.freelancer?.last_name || "freelancer"}-${params.id.slice(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}>
            <FileDown className="h-4 w-4 mr-2" /> Download Invoice PDF
          </Button>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={(open) => {
        if (!open && previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        setPreviewOpen(open);
      }}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          {previewLoading ? (
            <div className="flex items-center justify-center flex-1">
              <Spinner className="h-8 w-8 text-foreground" />
            </div>
          ) : previewUrl ? (
            <iframe src={previewUrl} className="w-full flex-1 rounded border" />
          ) : null}
        </DialogContent>
      </Dialog>

      {rejecting && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Textarea placeholder="Reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>Confirm Rejection</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
