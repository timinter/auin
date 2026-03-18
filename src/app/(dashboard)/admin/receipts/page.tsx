"use client";

import { useEffect, useState, useCallback } from "react";
import { useEntity } from "@/lib/hooks/use-entity";
import type { EmployeeCompensation, PayrollPeriod } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";

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
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {compensations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                    <TableCell className="text-right">{formatCurrency(comp.submitted_amount)}</TableCell>
                    <TableCell className="text-right">
                      {comp.status === "pending" ? (
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          defaultValue={comp.submitted_amount}
                          className="w-24 ml-auto text-right"
                          id={`comp-amount-${comp.id}`}
                        />
                      ) : (
                        comp.approved_amount != null ? formatCurrency(comp.approved_amount) : "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.receipt_url ? (
                        <a href={comp.receipt_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          View
                        </a>
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
                    <TableCell colSpan={3}>Totals ({compensations.length})</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(compensations.reduce((s, c) => s + c.submitted_amount, 0))}
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
    </div>
  );
}
