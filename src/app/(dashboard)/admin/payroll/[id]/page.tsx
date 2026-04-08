"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PayrollRecord, PayrollPeriod, EmployeeContract } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormField, clearFieldError } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { PageSpinner } from "@/components/spinner";

export default function EditPayrollPage({ params }: { params: { id: string } }) {
  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [contract, setContract] = useState<EmployeeContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraData, setJiraData] = useState<{
    jiraAvailable: boolean;
    totalHoursLogged: number;
    standardHours: number;
    overtimeHours: number;
    hourlyRate: number;
    suggestedOvertimeBonus: number;
  } | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    days_worked: 0,
    bonus: 0,
    bonus_note: "",
    compensation_amount: 0,
    adjustment_amount: 0,
    adjustment_reason: "",
  });

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: r } = await supabase
      .from("payroll_records")
      .select("*, employee:profiles(*), period:payroll_periods(*)")
      .eq("id", params.id)
      .single();

    if (r) {
      setRecord(r);
      setPeriod(r.period);
      setForm({
        days_worked: r.days_worked,
        bonus: r.bonus,
        bonus_note: r.bonus_note || "",
        compensation_amount: r.compensation_amount,
        adjustment_amount: r.adjustment_amount || 0,
        adjustment_reason: r.adjustment_reason || "",
      });

      const { data: c } = await supabase
        .from("employee_contracts")
        .select("*")
        .eq("employee_id", r.employee_id)
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .single();
      setContract(c);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const grossSalary = contract?.gross_salary || record?.gross_salary || 0;
  const workingDays = period?.working_days || 1;

  const proratedGross = useMemo(() => {
    return (grossSalary / workingDays) * form.days_worked;
  }, [grossSalary, workingDays, form.days_worked]);

  const totalAmount = useMemo(() => {
    return proratedGross
      + form.bonus
      + form.compensation_amount
      + form.adjustment_amount;
  }, [proratedGross, form.bonus, form.compensation_amount, form.adjustment_amount]);

  async function handleSave() {
    setSaving(true);
    setFieldErrors({});
    const res = await fetch(`/api/admin/payroll/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast({ title: "Saved" });
      loadData();
    } else {
      const data = await res.json();
      if (data.fieldErrors) {
        setFieldErrors(data.fieldErrors);
        toast({ title: "Please fix the highlighted fields", variant: "destructive" });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    }
    setSaving(false);
  }

  async function fetchJiraSuggestion() {
    if (!record || !period) return;
    setJiraLoading(true);
    try {
      const res = await fetch(
        `/api/admin/jira/bonus-suggestion?employee_id=${record.employee_id}&period_id=${period.id}`
      );
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Jira Error", description: data.error || "Failed to fetch", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setJiraData(data);
      if (data.jiraAvailable) {
        setForm((prev) => ({ ...prev, bonus: data.suggestedOvertimeBonus }));
        toast({ title: "Jira Data Loaded", description: `${data.totalHoursLogged}h logged, ${data.overtimeHours}h overtime → ${formatCurrency(data.suggestedOvertimeBonus)} suggested` });
      } else {
        toast({ title: "Jira Not Available", description: "Jira is not configured or no data found", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to fetch Jira data", variant: "destructive" });
    } finally {
      setJiraLoading(false);
    }
  }

  async function handleSend() {
    const res = await fetch(`/api/admin/payroll/${params.id}/send`, { method: "POST" });
    if (res.ok) {
      toast({ title: "Sent to employee for approval" });
      loadData();
    } else {
      const data = await res.json();
      toast({ title: "Error", description: data.error || "Failed to send", variant: "destructive" });
    }
  }

  function setField(key: string, value: string) {
    const num = parseFloat(value) || 0;
    setForm((prev) => ({ ...prev, [key]: num }));
  }

  if (loading || !record) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">
          {record.employee?.first_name} {record.employee?.last_name}
        </h1>
        <p className="text-muted-foreground">
          {period && formatPeriod(period.year, period.month)} &middot;{" "}
          <Badge variant={record.status === "draft" ? "secondary" : record.status === "approved" ? "success" : record.status === "rejected" ? "destructive" : "warning"}>
            {record.status.replace("_", " ")}
          </Badge>
        </p>
      </div>

      {record.rejection_reason && (
        <Card className="border-destructive">
          <CardHeader><CardTitle className="text-destructive">Rejection Reason</CardTitle></CardHeader>
          <CardContent>
            <p>{record.rejection_reason}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Payroll Calculation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Gross Salary</Label>
              <Input value={formatCurrency(grossSalary)} disabled />
            </div>
            <div>
              <Label>Working Days</Label>
              <Input value={workingDays} disabled />
            </div>
          </div>

          <FormField label="Days Worked" error={fieldErrors.days_worked} onClearError={clearFieldError(setFieldErrors, "days_worked")}>
            <Input type="number" min={0} max={workingDays} value={form.days_worked || ""} onFocus={(e) => e.target.select()} onChange={(e) => setField("days_worked", e.target.value)} />
          </FormField>

          <div className="p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Prorated Gross</p>
            <p className="text-lg font-semibold">{formatCurrency(proratedGross)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(grossSalary)} / {workingDays} x {form.days_worked}</p>
          </div>

          <Separator />

          <FormField label="Bonus" error={fieldErrors.bonus} onClearError={clearFieldError(setFieldErrors, "bonus")}>
            <div>
              <div className="flex gap-2">
                <Input type="number" value={form.bonus || ""} onFocus={(e) => e.target.select()} onChange={(e) => setField("bonus", e.target.value)} />
                <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={jiraLoading} onClick={fetchJiraSuggestion}>
                  {jiraLoading ? "Loading..." : "Jira"}
                </Button>
              </div>
              {jiraData?.jiraAvailable && (
                <p className="text-xs text-muted-foreground mt-1">
                  {jiraData.totalHoursLogged}h logged / {jiraData.standardHours}h standard · {jiraData.overtimeHours}h OT × {formatCurrency(jiraData.hourlyRate)}/h
                </p>
              )}
            </div>
          </FormField>

          {form.bonus > 0 && (
            <FormField label="Bonus Note" error={fieldErrors.bonus_note} onClearError={clearFieldError(setFieldErrors, "bonus_note")}>
              <Textarea value={form.bonus_note} onChange={(e) => setForm({ ...form, bonus_note: e.target.value })} />
            </FormField>
          )}

          <FormField label="Compensation" error={fieldErrors.compensation_amount} onClearError={clearFieldError(setFieldErrors, "compensation_amount")}>
            <Input type="number" value={form.compensation_amount || ""} onFocus={(e) => e.target.select()} onChange={(e) => setField("compensation_amount", e.target.value)} />
          </FormField>

          <Separator />

          <FormField label="Adjustment (positive = add, negative = deduct)" error={fieldErrors.adjustment_amount} onClearError={clearFieldError(setFieldErrors, "adjustment_amount")}>
            <Input type="number" value={form.adjustment_amount || ""} onFocus={(e) => e.target.select()} onChange={(e) => setField("adjustment_amount", e.target.value)} />
          </FormField>

          {form.adjustment_amount !== 0 && (
            <FormField label="Adjustment Reason" error={fieldErrors.adjustment_reason} onClearError={clearFieldError(setFieldErrors, "adjustment_reason")}>
              <Textarea value={form.adjustment_reason} onChange={(e) => setForm({ ...form, adjustment_reason: e.target.value })} placeholder="Reason for adjustment..." />
            </FormField>
          )}

          <Separator />

          <div className="p-4 bg-primary/5 rounded-md space-y-2">
            <p className="text-sm font-medium">Total Amount</p>
            <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Prorated Gross: {formatCurrency(proratedGross)}</p>
              {form.bonus > 0 && <p>+ Bonus: {formatCurrency(form.bonus)}{form.bonus_note ? ` (${form.bonus_note})` : ""}</p>}
              {form.compensation_amount > 0 && <p>+ Compensation: {formatCurrency(form.compensation_amount)}</p>}
              {form.adjustment_amount > 0 && <p>+ Adjustment: {formatCurrency(form.adjustment_amount)}{form.adjustment_reason ? ` (${form.adjustment_reason})` : ""}</p>}
              {form.adjustment_amount < 0 && <p>- Adjustment: {formatCurrency(Math.abs(form.adjustment_amount))}{form.adjustment_reason ? ` (${form.adjustment_reason})` : ""}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Draft"}</Button>
            {(record.status === "draft" || record.status === "rejected") && (
              <Button variant="secondary" onClick={handleSend}>Send to Employee</Button>
            )}
            {record.status === "approved" && record.employee?.entity !== "BY" && (
              <Button variant="outline" onClick={async () => {
                const res = await fetch(`/api/admin/payroll/${params.id}/pdf`);
                if (!res.ok) return;
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `invoice-${params.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}>
                Download Invoice PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
