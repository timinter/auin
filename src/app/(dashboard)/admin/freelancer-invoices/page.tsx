"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEntity } from "@/lib/hooks/use-entity";
import type { PayrollPeriod } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPeriod, formatCurrency } from "@/lib/utils";
import { Spinner } from "@/components/spinner";

interface PeriodSummary {
  period: PayrollPeriod;
  invoiceCount: number;
  totalAmount: number;
  approvedCount: number;
  pendingCount: number;
}

export default function FreelancerInvoicesPage() {
  const { entity } = useEntity();
  const [summaries, setSummaries] = useState<PeriodSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
    setLoading(true);
    const supabase = createClient();

    // Fetch all freelancer invoices with period data, filtered by entity
    const { data: invoices } = await supabase
      .from("freelancer_invoices")
      .select("*, freelancer:profiles!inner(*), period:payroll_periods(*)")
      .eq("freelancer.entity", entity)
      .order("created_at", { ascending: false });

    if (!invoices || invoices.length === 0) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    // Group by period
    const periodMap = new Map<string, PeriodSummary>();
    for (const inv of invoices) {
      if (!inv.period) continue;
      const key = inv.period.id;
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          period: inv.period,
          invoiceCount: 0,
          totalAmount: 0,
          approvedCount: 0,
          pendingCount: 0,
        });
      }
      const summary = periodMap.get(key)!;
      summary.invoiceCount++;
      summary.totalAmount += inv.total_amount || 0;
      if (inv.status === "approved") summary.approvedCount++;
      if (inv.status === "pending_approval") summary.pendingCount++;
    }

    // Sort by year desc, month desc
    const sorted = Array.from(periodMap.values()).sort((a, b) => {
      if (a.period.year !== b.period.year) return b.period.year - a.period.year;
      return b.period.month - a.period.month;
    });

    setSummaries(sorted);
    setLoading(false);
    }
    loadData();
  }, [entity]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Freelancer Invoices</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Invoices</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={4}><div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-foreground" /></div></TableCell></TableRow>
          ) : summaries.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No freelancer invoices found</TableCell></TableRow>
          ) : summaries.map((s) => (
            <TableRow key={s.period.id}>
              <TableCell>
                <Link href={`/admin/periods/${s.period.id}?tab=freelancers`} className="font-medium hover:underline">
                  {formatPeriod(s.period.year, s.period.month)}
                </Link>
              </TableCell>
              <TableCell>{s.invoiceCount}</TableCell>
              <TableCell className="font-semibold">{formatCurrency(s.totalAmount)}</TableCell>
              <TableCell className="space-x-2">
                {s.approvedCount > 0 && <Badge variant="success">{s.approvedCount} approved</Badge>}
                {s.pendingCount > 0 && <Badge variant="warning">{s.pendingCount} pending</Badge>}
                {s.invoiceCount - s.approvedCount - s.pendingCount > 0 && (
                  <Badge variant="secondary">{s.invoiceCount - s.approvedCount - s.pendingCount} other</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
