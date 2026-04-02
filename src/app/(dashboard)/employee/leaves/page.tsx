"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PayrollPeriod, LeaveRequest } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPeriod, formatDisplayDate } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  unpaid: "Unpaid Leave",
  sick: "Sick Leave",
  vacation: "Vacation",
  day_off: "Day Off",
};

export default function EmployeeLeavesPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: p } = await supabase
        .from("payroll_periods")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      setPeriods(p || []);
      if (p && p.length > 0) setSelectedPeriod(p[0].id);
      setLoading(false);
    }
    load();
  }, []);

  const loadLeaves = useCallback(async () => {
    if (!selectedPeriod) return;
    const res = await fetch(`/api/employee/leaves?period_id=${selectedPeriod}`);
    if (res.ok) setLeaves(await res.json());
  }, [selectedPeriod]);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  if (loading) return <PageSpinner />;

  const statusVariant = (s: string) => {
    switch (s) {
      case "approved": return "success" as const;
      case "rejected": return "destructive" as const;
      default: return "warning" as const;
    }
  };

  const totalDays = leaves.reduce((sum, l) => sum + l.days_count, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Leaves</h1>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>{formatPeriod(p.year, p.month)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Leave data is synced from PeopleForce. Contact HR to request or modify leaves.
      </p>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Leave History</CardTitle>
            {leaves.length > 0 && (
              <span className="text-sm text-muted-foreground">{totalDays} day{totalDays !== 1 ? "s" : ""} total</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No leaves recorded for this period
                  </TableCell>
                </TableRow>
              ) : leaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell className="font-medium">{LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDisplayDate(leave.start_date)} — {formatDisplayDate(leave.end_date)}</TableCell>
                  <TableCell className="text-right">{leave.days_count}</TableCell>
                  <TableCell className="max-w-48 truncate">{leave.reason || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(leave.status)}>{leave.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
