"use client";

import { useEffect, useState, useCallback } from "react";
import { useEntity } from "@/lib/hooks/use-entity";
import type { EmployeeCompensation, PayrollPeriod } from "@/types";
import type { CompensationBreakdown } from "@/lib/compensation/calculate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod, getApiError } from "@/lib/utils";
import { PageSpinner, Spinner } from "@/components/spinner";
import { Calculator } from "lucide-react";

const statusVariant = (s: string) => {
  switch (s) {
    case "approved": return "success" as const;
    case "rejected": return "destructive" as const;
    default: return "warning" as const;
  }
};

export default function AdminReceiptsPage() {
  const { entity } = useEntity();
  const { toast } = useToast();
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [breakdowns, setBreakdowns] = useState<Record<string, CompensationBreakdown>>({});
  const [calcLoading, setCalcLoading] = useState<Record<string, boolean>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load periods for filter dropdown
      const periodsRes = await fetch("/api/admin/periods");
      if (periodsRes.ok) {
        const data = await periodsRes.json();
        setPeriods(data);
      }

      // Build query params
      const params = new URLSearchParams();
      params.set("entity", entity);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (periodFilter !== "all") params.set("period_id", periodFilter);

      const res = await fetch(`/api/admin/compensations?${params}`);
      if (res.ok) {
        setCompensations(await res.json());
      } else {
        toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load receipts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entity, statusFilter, periodFilter, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleReview(compId: string, status: "approved" | "rejected", approvedAmount?: number) {
    const res = await fetch(`/api/admin/compensations/${compId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, approved_amount: approvedAmount }),
    });
    if (res.ok) {
      toast({ title: status === "approved" ? "Approved" : "Rejected" });
      loadData();
    } else {
      toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
    }
  }

  async function handleCalculate(compId: string) {
    setCalcLoading((prev) => ({ ...prev, [compId]: true }));
    try {
      const res = await fetch(`/api/admin/compensations/${compId}/calculate`);
      const data = await res.json();
      if (res.ok && data.breakdown) {
        setBreakdowns((prev) => ({ ...prev, [compId]: data.breakdown }));
        // Auto-fill the approved amount input
        const input = document.getElementById(`comp-amount-${compId}`) as HTMLInputElement;
        if (input) input.value = data.breakdown.approvedGross.toFixed(2);
      } else {
        toast({ title: "Calculation error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to calculate", variant: "destructive" });
    } finally {
      setCalcLoading((prev) => ({ ...prev, [compId]: false }));
    }
  }

  async function handlePreview(receiptPath: string) {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewUrl(null);
    setPreviewPath(receiptPath);

    // Legacy records may have a full signed URL stored
    if (receiptPath.startsWith("http")) {
      setPreviewUrl(receiptPath);
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/receipt-url?path=${encodeURIComponent(receiptPath)}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
      } else {
        toast({ title: "Error", description: "Failed to load receipt", variant: "destructive" });
        setPreviewOpen(false);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load receipt", variant: "destructive" });
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  const pendingCount = compensations.filter((c) => c.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Receipts & Compensations</h1>
        <p className="text-muted-foreground">
          Review employee compensation submissions
          {pendingCount > 0 && statusFilter === "all" && ` · ${pendingCount} pending`}
        </p>
      </div>

      <div className="flex gap-3 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All periods</SelectItem>
            {periods
              .sort((a, b) => b.year - a.year || b.month - a.month)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {formatPeriod(p.year, p.month)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Receipt Date</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="text-right">Approved (USD)</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {compensations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No receipts found.
                    </TableCell>
                  </TableRow>
                ) : compensations.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {comp.employee?.first_name} {comp.employee?.last_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {comp.period ? formatPeriod(comp.period.year, comp.period.month) : "—"}
                    </TableCell>
                    <TableCell>{comp.category?.label || "—"}</TableCell>
                    <TableCell>{comp.receipt_date || "—"}</TableCell>
                    <TableCell className="text-right">{comp.submitted_amount} {comp.submitted_currency || "BYN"}</TableCell>
                    <TableCell className="text-right">
                      {comp.status === "pending" ? (
                        <div className="flex items-center gap-1 justify-end">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  disabled={calcLoading[comp.id]}
                                  onClick={() => handleCalculate(comp.id)}
                                >
                                  <Calculator className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs max-w-64">
                                {breakdowns[comp.id] ? (
                                  <div className="space-y-1">
                                    <div>Receipt: {comp.submitted_amount} {comp.submitted_currency}</div>
                                    {breakdowns[comp.id].afterPercentage !== comp.submitted_amount && (
                                      <div>After coverage: {breakdowns[comp.id].afterPercentage.toFixed(2)} {comp.submitted_currency}</div>
                                    )}
                                    {comp.submitted_currency !== "USD" && (
                                      <div>In USD: ${breakdowns[comp.id].amountUsd.toFixed(2)}</div>
                                    )}
                                    <div>Gross: ${breakdowns[comp.id].grossAmount.toFixed(2)}</div>
                                    {breakdowns[comp.id].capApplied && (
                                      <div className="text-yellow-300">{breakdowns[comp.id].capApplied}</div>
                                    )}
                                    <div className="font-semibold">Approved: ${breakdowns[comp.id].approvedGross.toFixed(2)}</div>
                                  </div>
                                ) : (
                                  "Click to auto-calculate"
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            defaultValue={comp.submitted_amount}
                            className="w-24 text-right"
                            id={`comp-amount-${comp.id}`}
                          />
                        </div>
                      ) : (
                        comp.approved_amount != null ? formatCurrency(comp.approved_amount) : "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.receipt_url ? (
                        <button
                          onClick={() => handlePreview(comp.receipt_url!)}
                          className="text-sm text-primary hover:underline"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(comp.status)}>{comp.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {comp.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => {
                            const input = document.getElementById(`comp-amount-${comp.id}`) as HTMLInputElement;
                            const amt = parseFloat(input?.value) || comp.submitted_amount;
                            handleReview(comp.id, "approved", amt);
                          }}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReview(comp.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {compensations.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>Totals ({compensations.length})</TableCell>
                    <TableCell className="text-right">
                      {compensations.reduce((s, c) => s + c.submitted_amount, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(compensations.filter((c) => c.approved_amount != null).reduce((s, c) => s + (c.approved_amount || 0), 0))}
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px]">
            {previewLoading ? (
              <Spinner className="h-8 w-8 text-foreground" />
            ) : previewUrl ? (
              previewPath?.endsWith(".pdf") ? (
                <iframe src={previewUrl} className="w-full h-[75vh] rounded" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Receipt" className="max-w-full max-h-[75vh] object-contain rounded" />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
