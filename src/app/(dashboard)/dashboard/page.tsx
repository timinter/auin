"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { useEntity } from "@/lib/hooks/use-entity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriod } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, CheckCircle, Clock, AlertCircle, DollarSign, TrendingUp, Users, BarChart3 } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPeriod as formatPeriodLabel } from "@/lib/utils";
import { ENTITY_LABELS } from "@/lib/hooks/use-entity";

interface TrendData {
  year: number;
  month: number;
  employeeTotal: number;
  freelancerTotal: number;
  total: number;
}

interface DashboardStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  currentPeriod?: { year: number; month: number; id: string };
  // Admin-only enhanced stats
  totalPayroll?: number;
  totalFreelancer?: number;
  entityBreakdown?: Array<{
    entity: string;
    employeeCount: number;
    freelancerCount: number;
    employeeTotal: number;
    freelancerTotal: number;
  }>;
  previousPeriodTotal?: number;
}

export default function DashboardPage() {
  const { profile } = useProfile();
  const { entity } = useEntity();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [periods, setPeriods] = useState<Array<{ id: string; year: number; month: number }>>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  // Track entity switches separately so we skeleton values without hiding the whole page
  const [entityLoading, setEntityLoading] = useState(false);
  const prevEntityRef = useRef(entity);
  useEffect(() => {
    if (prevEntityRef.current !== entity) {
      setEntityLoading(true);
      setTrendsLoading(true);
      prevEntityRef.current = entity;
    }
  }, [entity]);

  const handlePeriodChange = (periodId: string) => {
    setStats(null);
    setTrends([]);
    setEntityLoading(true);
    setTrendsLoading(true);
    setSelectedPeriodId(periodId);
  };

  useEffect(() => {
    if (!profile) return;

    async function loadStats() {
      const supabase = createClient();

      // Fetch all periods for the selector
      const { data: allPeriods } = await supabase
        .from("payroll_periods")
        .select("id, year, month")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      const periodsList = allPeriods || [];
      setPeriods(periodsList);

      // Use selected period or fall back to latest
      const period = selectedPeriodId
        ? periodsList.find((p) => p.id === selectedPeriodId)
        : periodsList[0];

      if (!period) {
        setStats({ total: 0, approved: 0, pending: 0, rejected: 0 });
        setLoading(false);
        return;
      }

      if (!selectedPeriodId && periodsList.length > 0) {
        setSelectedPeriodId(periodsList[0].id);
      }

      if (profile!.role === "admin") {
        // Fetch all data in parallel: current period records + previous period lookup
        const [payrollResult, invoicesResult, prevPeriodResult] = await Promise.all([
          supabase
            .from("payroll_records")
            .select("status, total_amount, employee:profiles(entity)")
            .eq("period_id", period.id),
          supabase
            .from("freelancer_invoices")
            .select("status, total_amount, freelancer:profiles(entity)")
            .eq("period_id", period.id),
          supabase
            .from("payroll_periods")
            .select("id")
            .or(`year.lt.${period.year},and(year.eq.${period.year},month.lt.${period.month})`)
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .limit(1)
            .single(),
        ]);

        const allPayroll = payrollResult.data || [];
        const allInvoices = invoicesResult.data || [];

        // Entity-filtered counts for stat cards
        const entityPayroll = allPayroll.filter((r: Record<string, unknown>) => (r.employee as Record<string, unknown>)?.entity === entity);
        const entityInvoices = allInvoices.filter((r: Record<string, unknown>) => (r.freelancer as Record<string, unknown>)?.entity === entity);
        const all = [...entityPayroll, ...entityInvoices];

        const totalPayroll = allPayroll.reduce((s, r) => s + r.total_amount, 0);
        const totalFreelancer = allInvoices.reduce((s, r) => s + r.total_amount, 0);

        // Entity breakdown from already-fetched data
        const entities = ["BY", "US", "CRYPTO"];
        const entityBreakdown = entities.map((e) => {
          const ep = allPayroll.filter((r: Record<string, unknown>) => (r.employee as Record<string, unknown>)?.entity === e);
          const ef = allInvoices.filter((r: Record<string, unknown>) => (r.freelancer as Record<string, unknown>)?.entity === e);
          return {
            entity: e,
            employeeCount: ep.length,
            freelancerCount: ef.length,
            employeeTotal: ep.reduce((s, r) => s + r.total_amount, 0),
            freelancerTotal: ef.reduce((s, r) => s + r.total_amount, 0),
          };
        });

        // Previous period trend — also filtered by entity
        let previousPeriodTotal: number | undefined;
        const prevPeriod = prevPeriodResult.data;
        if (prevPeriod) {
          const [prevPayrollRes, prevInvoicesRes] = await Promise.all([
            supabase.from("payroll_records").select("total_amount, employee:profiles(entity)").eq("period_id", prevPeriod.id),
            supabase.from("freelancer_invoices").select("total_amount, freelancer:profiles(entity)").eq("period_id", prevPeriod.id),
          ]);
          const prevPayroll = (prevPayrollRes.data || []).filter(
            (r: Record<string, unknown>) => (r.employee as Record<string, unknown>)?.entity === entity
          );
          const prevInvoices = (prevInvoicesRes.data || []).filter(
            (r: Record<string, unknown>) => (r.freelancer as Record<string, unknown>)?.entity === entity
          );
          previousPeriodTotal =
            prevPayroll.reduce((s, r) => s + r.total_amount, 0) +
            prevInvoices.reduce((s, r) => s + r.total_amount, 0);
        }

        setStats({
          total: all.length,
          approved: all.filter((r) => r.status === "approved").length,
          pending: all.filter((r) => r.status === "pending_approval").length,
          rejected: all.filter((r) => r.status === "rejected").length,
          currentPeriod: period,
          totalPayroll,
          totalFreelancer,
          entityBreakdown,
          previousPeriodTotal,
        });

        // Fetch spending trends filtered by entity
        setTrendsLoading(true);
        try {
          const trendRes = await fetch(`/api/admin/dashboard-trends?entity=${encodeURIComponent(entity)}`);
          if (trendRes.ok) {
            setTrends(await trendRes.json());
          }
        } catch {
          // Non-critical, ignore
        }
        setTrendsLoading(false);
      } else if (profile!.role === "employee") {
        const { data: record } = await supabase
          .from("payroll_records")
          .select("status")
          .eq("period_id", period.id)
          .eq("employee_id", profile!.id)
          .single();

        setStats({
          total: record ? 1 : 0,
          approved: record?.status === "approved" ? 1 : 0,
          pending: record?.status === "pending_approval" ? 1 : 0,
          rejected: record?.status === "rejected" ? 1 : 0,
          currentPeriod: period,
        });
      } else {
        const { data: invoice } = await supabase
          .from("freelancer_invoices")
          .select("status")
          .eq("period_id", period.id)
          .eq("freelancer_id", profile!.id)
          .single();

        setStats({
          total: invoice ? 1 : 0,
          approved: invoice?.status === "approved" ? 1 : 0,
          pending: invoice?.status === "pending_approval" ? 1 : 0,
          rejected: invoice?.status === "rejected" ? 1 : 0,
          currentPeriod: period,
        });
      }

      setLoading(false);
      setEntityLoading(false);
    }

    loadStats();
  }, [profile, entity, selectedPeriodId]);

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  function getStatCardHref(role: string, periodId?: string, filter?: string) {
    if (role === "admin" && periodId) {
      const params = filter ? `?status=${filter}` : "";
      return `/admin/periods/${periodId}${params}`;
    }
    if (role === "employee") {
      return "/employee/payroll";
    }
    if (role === "freelancer") {
      return "/freelancer/invoices";
    }
    return "/dashboard";
  }

  const cards = [
    { label: "Total Records", value: stats?.total || 0, icon: FileText, color: "", iconColor: "text-muted-foreground", filter: "" },
    { label: "Approved", value: stats?.approved || 0, icon: CheckCircle, color: "text-green-600", iconColor: "text-green-600", filter: "approved" },
    { label: "Pending", value: stats?.pending || 0, icon: Clock, color: "text-yellow-600", iconColor: "text-yellow-600", filter: "pending_approval" },
    { label: "Rejected", value: stats?.rejected || 0, icon: AlertCircle, color: "text-red-600", iconColor: "text-red-600", filter: "rejected" },
  ];

  const entityLabel = ENTITY_LABELS[entity as keyof typeof ENTITY_LABELS] || entity;
  const entityData = stats?.entityBreakdown?.find((e) => e.entity === entity);
  const entityPayrollTotal = entityData?.employeeTotal || 0;
  const entityFreelancerTotal = entityData?.freelancerTotal || 0;
  const entityTotal = entityPayrollTotal + entityFreelancerTotal;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {profile.first_name}
          </h1>
          {stats?.currentPeriod && (
            <p className="text-muted-foreground">
              Current period: {formatPeriod(stats.currentPeriod.year, stats.currentPeriod.month)}
            </p>
          )}
        </div>
        {profile.role === "admin" && periods.length > 0 && (
          <Select value={selectedPeriodId || ""} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-48">
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
        )}
      </div>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const isClickable = !entityLoading && card.value > 0;
          const href = getStatCardHref(profile.role, stats?.currentPeriod?.id, card.filter);

          const cardContent = (
            <Card className={isClickable ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 ${card.iconColor}`} />
              </CardHeader>
              <CardContent>
                {entityLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                )}
              </CardContent>
            </Card>
          );

          if (isClickable) {
            return <Link key={card.label} href={href}>{cardContent}</Link>;
          }
          return <div key={card.label}>{cardContent}</div>;
        })}
      </div>

      {/* Financial summary cards — skeleton while loading */}
      {profile.role === "admin" && stats?.totalPayroll == null && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-36 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Financial summary cards */}
      {profile.role === "admin" && stats?.totalPayroll != null && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Employee Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {entityLoading ? (
                <><Skeleton className="h-8 w-36 mb-1" /><Skeleton className="h-3 w-20" /></>
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(entityPayrollTotal)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{entityLabel}</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Freelancer Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {entityLoading ? (
                <><Skeleton className="h-8 w-36 mb-1" /><Skeleton className="h-3 w-20" /></>
              ) : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(entityFreelancerTotal)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{entityLabel}</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Period Trend</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {entityLoading ? (
                <><Skeleton className="h-8 w-36 mb-1" /><Skeleton className="h-3 w-20" /></>
              ) : stats.previousPeriodTotal != null ? (() => {
                const prev = stats.previousPeriodTotal!;
                const diff = prev > 0 ? ((entityTotal - prev) / prev) * 100 : 0;
                return (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(entityTotal)}</div>
                    <p className={`text-xs mt-1 ${diff > 0 ? "text-green-500" : diff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(1)}% vs previous period
                    </p>
                  </>
                );
              })() : (
                <>
                  <div className="text-2xl font-bold">{formatCurrency(entityTotal)}</div>
                  <p className="text-xs text-muted-foreground mt-1">No previous period data</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick actions — above breakdown and trends for quick access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {profile.role === "admin" && (
            <>
              <Link
                href="/admin/periods"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Manage Periods
              </Link>
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Manage Users
              </Link>
              <Link
                href="/admin/freelancer-invoices"
                className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Review Invoices
              </Link>
              <Link
                href="/admin/reports"
                className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                View Reports
              </Link>
            </>
          )}
          {profile.role === "employee" && (
            <>
              <Link
                href="/employee/payroll"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                View Payroll
              </Link>
              <Link
                href="/employee/profile"
                className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Update Profile
              </Link>
            </>
          )}
          {profile.role === "freelancer" && (
            <>
              <Link
                href="/freelancer/invoices/new"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Submit Hours
              </Link>
              <Link
                href="/freelancer/invoices"
                className="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                View Invoices
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {/* Entity breakdown — filtered to selected entity */}
      {profile.role === "admin" && stats?.entityBreakdown && entityData && (entityData.employeeCount > 0 || entityData.freelancerCount > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{entityLabel} Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {entityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Employees</TableCell>
                    <TableCell className="text-center">{entityData.employeeCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entityData.employeeTotal)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Freelancers</TableCell>
                    <TableCell className="text-center">{entityData.freelancerCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entityData.freelancerTotal)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{entityData.employeeCount + entityData.freelancerCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entityData.employeeTotal + entityData.freelancerTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Spending trends — skeleton while loading */}
      {profile.role === "admin" && trendsLoading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Spending Trends</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-6 rounded" style={{ width: `${90 - i * 15}%` }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spending trends chart — filtered by entity */}
      {profile.role === "admin" && !trendsLoading && trends.length > 0 && (() => {
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Spending Trends — {entityLabel}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trends.map((t) => {
                  const empPct = t.total > 0 ? (t.employeeTotal / t.total) * 100 : 0;
                  const freePct = t.total > 0 ? (t.freelancerTotal / t.total) * 100 : 0;
                  return (
                    <div key={`${t.year}-${t.month}`} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{formatPeriodLabel(t.year, t.month)}</span>
                        <span className="text-muted-foreground">{formatCurrency(t.total)}</span>
                      </div>
                      <div className="h-6 w-full rounded bg-muted/50 overflow-hidden">
                        {t.total > 0 ? (
                          <div className="flex h-full">
                            <div
                              className="h-full rounded-l transition-all"
                              style={{ width: `${empPct}%`, backgroundColor: "#1C5253" }}
                              title={`Employees: ${formatCurrency(t.employeeTotal)}`}
                            />
                            <div
                              className="h-full rounded-r transition-all"
                              style={{ width: `${freePct}%`, backgroundColor: "#ffeba3" }}
                              title={`Freelancers: ${formatCurrency(t.freelancerTotal)}`}
                            />
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No data
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded" style={{ backgroundColor: "#1C5253" }} />
                  Employees
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded" style={{ backgroundColor: "#ffeba3" }} />
                  Freelancers
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
