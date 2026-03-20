"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { PayrollRecord, EmployeeCompensation } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";

export default function EmployeePayrollDetailPage({ params }: { params: { id: string } }) {
  const { profile } = useProfile();
  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { toast } = useToast();

  const profileMissing = (() => {
    if (!profile) return [];
    const missing: string[] = [];
    if (!profile.personal_email) missing.push("Personal Email");
    if (!profile.legal_address) missing.push("Legal Address");
    const bank = profile.bank_details || {};
    if (!bank.bank_name) missing.push("Bank Name");
    if (!bank.account_number) missing.push("Account Number");
    if (!bank.swift) missing.push("SWIFT");
    if (!bank.iban) missing.push("IBAN");
    if (!bank.bank_address) missing.push("Bank Address");
    return missing;
  })();

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("payroll_records")
      .select("*, period:payroll_periods(*)")
      .eq("id", params.id)
      .single();
    setRecord(data);

    // Load employee's compensations for this period
    if (data?.period_id && profile) {
      const { data: comps } = await supabase
        .from("employee_compensations")
        .select("*, category:compensation_categories(*)")
        .eq("employee_id", profile.id)
        .eq("period_id", data.period_id)
        .eq("status", "approved");
      setCompensations(comps || []);
    }

    setLoading(false);
  }, [params.id, profile]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove() {
    const res = await fetch(`/api/employee/payroll/${params.id}/approve`, { method: "PATCH" });
    if (res.ok) {
      toast({ title: "Payroll approved" });
      loadData();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  async function handleReject() {
    const res = await fetch(`/api/employee/payroll/${params.id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rejection_reason: rejectReason }),
    });
    if (res.ok) {
      toast({ title: "Correction requested" });
      setRejecting(false);
      loadData();
    }
  }

  if (loading || !record) return <PageSpinner />;

  const statusVariant = () => {
    switch (record.status) {
      case "approved": return "success" as const;
      case "pending_approval": return "warning" as const;
      case "rejected": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Payroll Details</h1>
        <p className="text-muted-foreground">
          {record.period && formatPeriod(record.period.year, record.period.month)} &middot;{" "}
          <Badge variant={statusVariant()}>{record.status.replace("_", " ")}</Badge>
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Gross Salary</span><span>{formatCurrency(record.gross_salary)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Working Days</span><span>{record.period?.working_days}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Days Worked</span><span>{record.days_worked}</span></div>
          <div className="flex justify-between font-medium"><span>Prorated Gross</span><span>{formatCurrency(record.prorated_gross)}</span></div>

          <Separator />

          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Bonus{record.bonus_note ? ` (${record.bonus_note})` : ""}
            </span>
            <span>{formatCurrency(record.bonus)}</span>
          </div>

          <Separator />

          <div className="flex justify-between"><span className="text-muted-foreground">Compensation</span><span>{formatCurrency(record.compensation_amount)}</span></div>

          {record.adjustment_amount !== 0 && (
            <>
              <Separator />
              <div className="flex justify-between">
                <span className={record.adjustment_amount > 0 ? "text-emerald-600" : "text-red-600"}>
                  Adjustment{record.adjustment_reason ? ` (${record.adjustment_reason})` : ""}
                </span>
                <span className={record.adjustment_amount > 0 ? "text-emerald-600" : "text-red-600"}>
                  {record.adjustment_amount > 0 ? "+" : ""}{formatCurrency(record.adjustment_amount)}
                </span>
              </div>
            </>
          )}

          <Separator />

          <div className="flex justify-between text-lg font-bold p-3 bg-primary/5 rounded-md">
            <span>Total Amount</span>
            <span>{formatCurrency(record.total_amount)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Compensation breakdown by category */}
      {compensations.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Approved Compensations</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compensations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.category?.label || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.approved_amount || 0)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(compensations.reduce((s, c) => s + (c.approved_amount || 0), 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {record.status === "rejected" && record.rejection_reason && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive font-medium">Your correction request:</p>
            <p className="text-sm">{record.rejection_reason}</p>
            <p className="text-xs text-muted-foreground mt-2">Waiting for admin to update and re-send.</p>
          </CardContent>
        </Card>
      )}

      {record.status === "approved" && record.invoice_file_url && (
        <Card>
          <CardContent className="pt-6">
            <a href={record.invoice_file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              View Invoice PDF
            </a>
          </CardContent>
        </Card>
      )}

      {record.status === "pending_approval" && profileMissing.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-yellow-800">
              Please complete your profile before approving. Missing: {profileMissing.join(", ")}
            </p>
            <a href="/employee/profile" className="text-sm text-primary hover:underline mt-1 inline-block">
              Go to Profile
            </a>
          </CardContent>
        </Card>
      )}

      {record.status === "pending_approval" && (
        <div className="flex gap-4">
          <Button onClick={handleApprove} disabled={profileMissing.length > 0}>Approve</Button>
          <Button variant="outline" onClick={() => setRejecting(!rejecting)}>Request Correction</Button>
        </div>
      )}

      {rejecting && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Textarea placeholder="What needs to be corrected?" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>Submit Correction Request</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
