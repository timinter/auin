"use client";

import { useEffect, useState, useCallback } from "react";
import { useEntity } from "@/lib/hooks/use-entity";
import type { LeaveRequest, PayrollPeriod } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatPeriod, formatDisplayDate, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  unpaid: "Unpaid Leave",
  sick: "Sick Leave",
  vacation: "Vacation",
};

const statusVariant = (s: string) => {
  switch (s) {
    case "approved": return "success" as const;
    case "rejected": return "destructive" as const;
    default: return "warning" as const;
  }
};

export default function AdminLeavesPage() {
  const { entity } = useEntity();
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const periodsRes = await fetch("/api/admin/periods");
      if (periodsRes.ok) setPeriods(await periodsRes.json());

      const params = new URLSearchParams();
      params.set("entity", entity);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (periodFilter !== "all") params.set("period_id", periodFilter);

      const res = await fetch(`/api/admin/leaves?${params}`);
      if (res.ok) {
        setLeaves(await res.json());
      } else {
        toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load leaves", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entity, statusFilter, periodFilter, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove(id: string) {
    const res = await fetch(`/api/admin/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) {
      toast({ title: "Leave approved" });
      loadData();
    } else {
      toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
    }
  }

  async function handleReject() {
    if (!rejectingId || !rejectReason) return;
    const res = await fetch(`/api/admin/leaves/${rejectingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", rejection_reason: rejectReason }),
    });
    if (res.ok) {
      toast({ title: "Leave rejected" });
      setRejectDialogOpen(false);
      setRejectingId(null);
      setRejectReason("");
      loadData();
    } else {
      toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
    }
  }

  const pendingCount = leaves.filter((l) => l.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leave Requests</h1>
        <p className="text-muted-foreground">
          Manage employee leave requests
          {pendingCount > 0 && statusFilter === "all" && ` · ${pendingCount} pending`}
        </p>
      </div>

      <div className="flex gap-3 items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All periods</SelectItem>
            {periods
              .sort((a, b) => b.year - a.year || b.month - a.month)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>{formatPeriod(p.year, p.month)}</SelectItem>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No leave requests found.
                    </TableCell>
                  </TableRow>
                ) : leaves.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {leave.employee?.first_name} {leave.employee?.last_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {leave.period ? formatPeriod(leave.period.year, leave.period.month) : "—"}
                    </TableCell>
                    <TableCell>{LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDisplayDate(leave.start_date)} — {formatDisplayDate(leave.end_date)}</TableCell>
                    <TableCell className="text-right">{leave.days_count}</TableCell>
                    <TableCell className="max-w-48 truncate">{leave.reason || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(leave.status)}>{leave.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {leave.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleApprove(leave.id)}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => {
                            setRejectingId(leave.id);
                            setRejectDialogOpen(true);
                          }}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {leaves.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4}>Total ({leaves.length})</TableCell>
                    <TableCell className="text-right">
                      {leaves.reduce((s, l) => s + l.days_count, 0)}
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
