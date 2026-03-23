"use client";

import { useEffect, useState, useCallback } from "react";
import { useEntity } from "@/lib/hooks/use-entity";
import type { EmployeeCompensation, PayrollPeriod } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod, formatDisplayDate, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { Download } from "lucide-react";

const statusVariant = (s: string) => {
  switch (s) {
    case "approved": return "success" as const;
    case "rejected": return "destructive" as const;
    default: return "warning" as const;
  }
};

export default function CompensationReportPage() {
  const { entity } = useEntity();
  const { toast } = useToast();
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const periodsRes = await fetch("/api/admin/periods");
      if (periodsRes.ok) {
        const data = await periodsRes.json();
        setPeriods(data);
        if (!periodFilter && data.length > 0) {
          setPeriodFilter(data[0].id);
          return; // Will re-trigger via effect
        }
      }

      if (!periodFilter) { setLoading(false); return; }

      const params = new URLSearchParams();
      params.set("entity", entity);
      params.set("status", "approved");
      params.set("period_id", periodFilter);

      const res = await fetch(`/api/admin/compensations?${params}`);
      if (res.ok) {
        setCompensations(await res.json());
      } else {
        toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entity, periodFilter, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Get unique categories from loaded data
  const categories = Array.from(
    new Map(compensations.map((c) => [c.category_id, c.category?.label || "Unknown"])).entries()
  );

  const filtered = categoryFilter === "all"
    ? compensations
    : compensations.filter((c) => c.category_id === categoryFilter);

  // Group by category for summary
  const byCategorySummary = new Map<string, { label: string; count: number; total: number }>();
  for (const c of compensations) {
    const key = c.category_id;
    const existing = byCategorySummary.get(key) || { label: c.category?.label || "Unknown", count: 0, total: 0 };
    existing.count += 1;
    existing.total += c.approved_amount || 0;
    byCategorySummary.set(key, existing);
  }

  function exportCsv() {
    const header = ["Employee", "Category", "Receipt Date", "Submitted Amount", "Submitted Currency", "Approved (USD)", "Status"];
    const rows = filtered.map((c) => [
      `${c.employee?.first_name || ""} ${c.employee?.last_name || ""}`.trim(),
      c.category?.label || "",
      c.receipt_date || "",
      c.submitted_amount.toFixed(2),
      c.submitted_currency || "BYN",
      c.approved_amount != null ? c.approved_amount.toFixed(2) : "",
      c.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const period = periods.find((p) => p.id === periodFilter);
    a.download = period
      ? `compensations_${period.year}_${String(period.month).padStart(2, "0")}_${entity}.csv`
      : `compensations_${entity}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const totalApproved = filtered.reduce((s, c) => s + (c.approved_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compensation Report</h1>
          <p className="text-muted-foreground">Detailed approved compensations by period</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select period" /></SelectTrigger>
          <SelectContent>
            {periods
              .sort((a, b) => b.year - a.year || b.month - a.month)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>{formatPeriod(p.year, p.month)}</SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(([id, label]) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards by category */}
      {byCategorySummary.size > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from(byCategorySummary.entries()).map(([id, summary]) => (
            <Card key={id} className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setCategoryFilter(categoryFilter === id ? "all" : id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{summary.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatCurrency(summary.total)}</p>
                <p className="text-xs text-muted-foreground">{summary.count} receipt{summary.count !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Receipt Date</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="text-right">Approved (USD)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No approved compensations for this period.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((comp) => (
                  <TableRow key={comp.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {comp.employee?.first_name} {comp.employee?.last_name}
                    </TableCell>
                    <TableCell>{comp.category?.label || "—"}</TableCell>
                    <TableCell>{comp.receipt_date ? formatDisplayDate(comp.receipt_date) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {comp.submitted_amount.toFixed(2)} {comp.submitted_currency || "BYN"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {comp.approved_amount != null ? formatCurrency(comp.approved_amount) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(comp.status)}>{comp.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>Total ({filtered.length})</TableCell>
                    <TableCell className="text-right">
                      {filtered.reduce((s, c) => s + c.submitted_amount, 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(totalApproved)}</TableCell>
                    <TableCell />
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
