"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PayrollPeriod, LeaveRequest } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatPeriod, formatDisplayDate, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  unpaid: "Unpaid Leave",
  sick: "Sick Leave",
  vacation: "Vacation",
};

export default function EmployeeLeavesPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [leaveType, setLeaveType] = useState<string>("unpaid");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daysCount, setDaysCount] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: p } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("status", "open")
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

  async function handleSubmit() {
    if (!selectedPeriod || !startDate || !endDate || !daysCount) {
      toast({ title: "Fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/employee/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_id: selectedPeriod,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days_count: parseInt(daysCount),
        reason: reason || undefined,
      }),
    });

    if (res.ok) {
      toast({ title: "Leave request submitted" });
      setStartDate("");
      setEndDate("");
      setDaysCount("");
      setReason("");
      loadLeaves();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
    setSubmitting(false);
  }

  if (loading) return <PageSpinner />;

  const statusVariant = (s: string) => {
    switch (s) {
      case "approved": return "success" as const;
      case "rejected": return "destructive" as const;
      default: return "warning" as const;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">My Leaves</h1>

      <div>
        <Label>Period</Label>
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>{formatPeriod(p.year, p.month)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle>Request Leave</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <Label>Leave Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Working Days</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={daysCount}
                onChange={(e) => setDaysCount(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave..." />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !startDate || !endDate || !daysCount}>
            {submitting ? "Submitting..." : "Submit Request"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Leave History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No leave requests for this period
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
                    {leave.status === "rejected" && leave.rejection_reason && (
                      <p className="text-xs text-destructive mt-1">{leave.rejection_reason}</p>
                    )}
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
