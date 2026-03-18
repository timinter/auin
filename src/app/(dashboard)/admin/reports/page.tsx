"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PayrollPeriod } from "@/types";
import { ENTITY_LABELS } from "@/lib/hooks/use-entity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSpinner } from "@/components/spinner";
import { formatPeriod, formatCurrency } from "@/lib/utils";

interface EntitySummary {
  entity: string;
  employees: {
    count: number;
    total_gross: number;
    total_prorated: number;
    total_bonuses: number;
    total_compensation: number;
    total_amount: number;
    by_status: Record<string, number>;
  };
  freelancers: {
    count: number;
    total_amount: number;
    by_status: Record<string, number>;
  };
  compensations: {
    count: number;
    total_submitted: number;
    total_approved: number;
    by_status: Record<string, number>;
  };
}

interface ReportData {
  summary: EntitySummary[];
  grand: {
    employee_total: number;
    freelancer_total: number;
    compensation_total: number;
  };
  exchange_rates: Array<{ from_currency: string; to_currency: string; rate: number; rate_date: string }>;
}

export default function ReportsPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    async function loadPeriods() {
      const supabase = createClient();
      const { data } = await supabase
        .from("payroll_periods")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      setPeriods(data || []);
      if (data && data.length > 0) {
        setSelectedPeriod(data[0].id);
      }
      setLoading(false);
    }
    loadPeriods();
  }, []);

  useEffect(() => {
    if (!selectedPeriod) return;
    async function loadReport() {
      setLoadingReport(true);
      const res = await fetch(`/api/admin/reports?period_id=${selectedPeriod}`);
      if (res.ok) {
        setReport(await res.json());
      }
      setLoadingReport(false);
    }
    loadReport();
  }, [selectedPeriod]);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cross-Entity Report</h1>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {formatPeriod(p.year, p.month)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadingReport ? (
        <PageSpinner />
      ) : report ? (
        <>
          {/* Grand totals */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Employee Payroll</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(report.grand.employee_total)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Freelancer Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(report.grand.freelancer_total)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Compensations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(report.grand.compensation_total)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Grand Total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatCurrency(report.grand.employee_total + report.grand.freelancer_total)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Employee payroll breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Payroll by Entity</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Prorated</TableHead>
                    <TableHead className="text-right">Bonuses</TableHead>
                    <TableHead className="text-right">Comp.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Draft</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">Approved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.summary.map((s) => (
                    <TableRow key={s.entity}>
                      <TableCell className="font-medium">{ENTITY_LABELS[s.entity as keyof typeof ENTITY_LABELS] || s.entity}</TableCell>
                      <TableCell className="text-center">{s.employees.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.employees.total_gross)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.employees.total_prorated)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.employees.total_bonuses)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.employees.total_compensation)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(s.employees.total_amount)}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.employees.by_status.draft || 0}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.employees.by_status.pending_approval || 0}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.employees.by_status.approved || 0}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{report.summary.reduce((s, e) => s + e.employees.count, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.summary.reduce((s, e) => s + e.employees.total_gross, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.summary.reduce((s, e) => s + e.employees.total_prorated, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.summary.reduce((s, e) => s + e.employees.total_bonuses, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.summary.reduce((s, e) => s + e.employees.total_compensation, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.grand.employee_total)}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Freelancer breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Freelancer Invoices by Entity</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Draft</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">Approved</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.summary.map((s) => (
                    <TableRow key={s.entity}>
                      <TableCell className="font-medium">{ENTITY_LABELS[s.entity as keyof typeof ENTITY_LABELS] || s.entity}</TableCell>
                      <TableCell className="text-center">{s.freelancers.count}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(s.freelancers.total_amount)}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.freelancers.by_status.draft || 0}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.freelancers.by_status.pending_approval || 0}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.freelancers.by_status.approved || 0}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.freelancers.by_status.rejected || 0}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{report.summary.reduce((s, e) => s + e.freelancers.count, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.grand.freelancer_total)}</TableCell>
                    <TableCell colSpan={4} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Compensations breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Compensations by Entity</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                    <TableHead className="text-right">Submitted</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">Approved</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.summary.map((s) => (
                    <TableRow key={s.entity}>
                      <TableCell className="font-medium">{ENTITY_LABELS[s.entity as keyof typeof ENTITY_LABELS] || s.entity}</TableCell>
                      <TableCell className="text-center">{s.compensations.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.compensations.total_submitted)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(s.compensations.total_approved)}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.compensations.by_status.pending || 0}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.compensations.by_status.approved || 0}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{s.compensations.by_status.rejected || 0}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{report.summary.reduce((s, e) => s + e.compensations.count, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.summary.reduce((s, e) => s + e.compensations.total_submitted, 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.grand.compensation_total)}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Exchange rates */}
          {report.exchange_rates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Exchange Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.exchange_rates.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.from_currency}</TableCell>
                        <TableCell>{r.to_currency}</TableCell>
                        <TableCell className="text-right">{r.rate}</TableCell>
                        <TableCell>{r.rate_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-center py-12">Select a period to view the report.</p>
      )}
    </div>
  );
}
