"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEntity } from "@/lib/hooks/use-entity";
import type { PayrollPeriod, PayrollRecord, FreelancerInvoice, EmployeeCompensation } from "@/types";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Lock, LockOpen, Download, Pencil, Send, CheckCircle, XCircle } from "lucide-react";
import { PageSpinner, Spinner } from "@/components/spinner";
import { formatPeriod, formatCurrency, getApiError } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

type EditableFields = {
  days_worked: number | string;
  bonus: number | string;
  compensation_amount: number | string;
};

const statusVariant = (s: string) => {
  switch (s) {
    case "approved": return "success" as const;
    case "pending_approval": return "warning" as const;
    case "rejected": return "destructive" as const;
    default: return "secondary" as const;
  }
};

export default function PeriodDetailPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const defaultTab = tabParam === "freelancers" ? "freelancers" : tabParam === "compensations" ? "compensations" : "employees";
  const statusFilter = searchParams.get("status") || null;
  const { entity } = useEntity();
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [freelancerInvoices, setFreelancerInvoices] = useState<FreelancerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [receiptPreviewPath, setReceiptPreviewPath] = useState<string | null>(null);
  const [receiptPreviewLoading, setReceiptPreviewLoading] = useState(false);
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [tableEditMode, setTableEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, EditableFields>>({});
  const [saving, setSaving] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<Set<string>>(new Set());
  const [batchSending, setBatchSending] = useState(false);
  const [batchActioning, setBatchActioning] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [nbrbRate, setNbrbRate] = useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: p } = await supabase.from("payroll_periods").select("*").eq("id", params.id).single();
    setPeriod(p);

    const { data: pr } = await supabase
      .from("payroll_records")
      .select("*, employee:profiles!inner(*)")
      .eq("period_id", params.id)
      .eq("employee.entity", entity);
    setPayrollRecords(
      (pr || []).sort((a, b) =>
        (a.employee?.last_name || "").localeCompare(b.employee?.last_name || "")
      )
    );

    const { data: fi } = await supabase
      .from("freelancer_invoices")
      .select("*, freelancer:profiles!inner(*)")
      .eq("period_id", params.id)
      .eq("freelancer.entity", entity);
    setFreelancerInvoices(
      (fi || []).sort((a, b) =>
        (a.freelancer?.last_name || "").localeCompare(b.freelancer?.last_name || "")
      )
    );

    // Load compensations
    const compRes = await fetch(`/api/admin/compensations?period_id=${params.id}&entity=${entity}`);
    if (compRes.ok) {
      setCompensations(await compRes.json());
    }

    // Load exchange rate
    const rateRes = await fetch(`/api/admin/exchange-rates?period_id=${params.id}`);
    if (rateRes.ok) {
      const rates = await rateRes.json();
      const bynRate = rates.find((r: { from_currency: string }) => r.from_currency === "BYN");
      setNbrbRate(bynRate?.rate ?? null);
    }

    setLoading(false);
  }, [params.id, entity]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleGenerate() {
    setGenerating(true);
    const res = await fetch("/api/admin/payroll/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_id: params.id, entity }),
    });
    if (res.ok) {
      const data = await res.json();
      const desc = data.skippedNoContract > 0
        ? `${data.count} records created. ${data.skippedNoContract} employee(s) skipped — no active contract found.`
        : `${data.count} records created`;
      toast({ title: "Payroll generated", description: desc, ...(data.skippedNoContract > 0 ? { variant: "destructive" as const } : {}) });
      loadData();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
    setGenerating(false);
  }

  async function handleToggleLock() {
    if (!period) return;
    const newStatus = period.status === "open" ? "locked" : "open";
    const res = await fetch("/api/admin/periods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: period.id, status: newStatus }),
    });
    if (res.ok) {
      toast({ title: `Period ${newStatus}` });
      loadData();
    }
  }

  async function handleDelete() {
    if (!period) return;
    const totalRecords = payrollRecords.length + freelancerInvoices.length + compensations.length;
    const message = totalRecords > 0
      ? `This will permanently delete this period and all ${totalRecords} associated record(s) (payroll, invoices, compensations). This cannot be undone. Continue?`
      : "Delete this period? This cannot be undone.";
    if (!confirm(message)) return;
    setDeleting(true);
    const res = await fetch("/api/admin/periods", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: period.id }),
    });
    if (res.ok) {
      toast({ title: "Period deleted" });
      router.push("/admin/periods");
    } else {
      const data = await res.json();
      toast({ title: "Error", description: data.error, variant: "destructive" });
      setDeleting(false);
    }
  }

  const filteredPayroll = statusFilter
    ? payrollRecords.filter((r) => r.status === statusFilter)
    : payrollRecords;
  const filteredFreelancer = freelancerInvoices.filter((inv) => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (paymentFilter !== "all" && inv.freelancer?.payment_channel !== paymentFilter) return false;
    return true;
  });

  function clearStatusFilter() {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("status");
    const qs = p.toString() ? `?${p.toString()}` : "";
    router.replace(`/admin/periods/${params.id}${qs}`, { scroll: false });
  }

  const approvedUsRecords = payrollRecords.filter(
    (r) => r.status === "approved" && r.employee?.entity !== "BY"
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBatchDownload() {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/payroll/download-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const errMsg = await getApiError(res);
        toast({ title: "Error", description: errMsg, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "payroll.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  async function handleExportCsv() {
    try {
      const res = await fetch("/api/admin/payroll/export-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id: params.id, entity }),
      });
      if (!res.ok) {
        const errMsg = await getApiError(res);
        toast({ title: "Error", description: errMsg, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }

  async function handleFetchNbrbRate() {
    setFetchingRate(true);
    try {
      const res = await fetch("/api/admin/exchange-rates/fetch-nbrb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_id: params.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setNbrbRate(data.rate);
        toast({ title: `NBRB rate fetched: 1 USD = ${data.rate} BYN` });
      } else {
        const err = await res.json();
        toast({ title: "Error", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to fetch NBRB rate", variant: "destructive" });
    } finally {
      setFetchingRate(false);
    }
  }

  function enterTableEdit() {
    const data: Record<string, EditableFields> = {};
    for (const r of payrollRecords) {
      data[r.id] = {
        days_worked: r.days_worked,
        bonus: r.bonus,
        compensation_amount: r.compensation_amount,
      };
    }
    setEditData(data);
    setTableEditMode(true);
  }

  function updateField(id: string, field: keyof EditableFields, value: number | string) {
    setEditData((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function handleSaveAll() {
    // Build updates only for changed records
    const updates: Array<{ id: string } & Partial<EditableFields>> = [];
    for (const r of payrollRecords) {
      const ed = editData[r.id];
      if (!ed) continue;
      const changed: Partial<EditableFields> = {};
      if (ed.days_worked !== r.days_worked) changed.days_worked = ed.days_worked;
      if (ed.bonus !== r.bonus) changed.bonus = ed.bonus;
      if (ed.compensation_amount !== r.compensation_amount) changed.compensation_amount = ed.compensation_amount;
      if (Object.keys(changed).length > 0) {
        const coerced = Object.fromEntries(
          Object.entries(changed).map(([k, v]) => [k, typeof v === "string" ? (v === "" ? 0 : parseFloat(v) || 0) : v])
        );
        updates.push({ id: r.id, ...coerced });
      }
    }
    if (updates.length === 0) {
      toast({ title: "No changes to save" });
      setTableEditMode(false);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/payroll/batch", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
    if (res.ok) {
      const data = await res.json();
      toast({ title: `Updated ${data.updated} records` });
      setTableEditMode(false);
      loadData();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleReceiptPreview(receiptPath: string) {
    setReceiptPreviewOpen(true);
    setReceiptPreviewLoading(true);
    setReceiptPreviewUrl(null);
    setReceiptPreviewPath(receiptPath);

    if (receiptPath.startsWith("http")) {
      setReceiptPreviewUrl(receiptPath);
      setReceiptPreviewLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/receipt-url?path=${encodeURIComponent(receiptPath)}`);
      if (res.ok) {
        const data = await res.json();
        setReceiptPreviewUrl(data.url);
      } else {
        toast({ title: "Error", description: "Failed to load receipt", variant: "destructive" });
        setReceiptPreviewOpen(false);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load receipt", variant: "destructive" });
      setReceiptPreviewOpen(false);
    } finally {
      setReceiptPreviewLoading(false);
    }
  }

  async function handleCompensationReview(compId: string, status: "approved" | "rejected", approvedAmount?: number) {
    const res = await fetch(`/api/admin/compensations/${compId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, approved_amount: approvedAmount }),
    });
    if (res.ok) {
      toast({ title: `Compensation ${status}` });
      loadData();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  // Employees: sendable = draft or rejected
  const sendableRecords = filteredPayroll.filter((r) => r.status === "draft" || r.status === "rejected");
  const selectedSendable = sendableRecords.filter((r) => selectedIds.has(r.id));

  // Freelancers: actionable = pending_approval
  const actionableInvoices = filteredFreelancer.filter((inv) => inv.status === "pending_approval");
  const selectedActionable = actionableInvoices.filter((inv) => selectedFreelancerIds.has(inv.id));
  const allActionableSelected = actionableInvoices.length > 0 && actionableInvoices.every((inv) => selectedFreelancerIds.has(inv.id));

  function toggleFreelancerSelect(id: string) {
    setSelectedFreelancerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleFreelancerSelectAll() {
    if (allActionableSelected) {
      setSelectedFreelancerIds(new Set());
    } else {
      setSelectedFreelancerIds(new Set(actionableInvoices.map((inv) => inv.id)));
    }
  }

  async function handleBatchSend() {
    if (selectedSendable.length === 0) return;
    setBatchSending(true);
    try {
      const res = await fetch("/api/admin/payroll/batch-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSendable.map((r) => r.id) }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: `Sent ${data.sent} payroll records`, description: data.skipped ? `${data.skipped} skipped` : undefined });
        setSelectedIds(new Set());
        loadData();
      } else {
        const errMsg = await getApiError(res);
        toast({ title: "Error", description: errMsg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Batch send failed", variant: "destructive" });
    } finally {
      setBatchSending(false);
    }
  }

  async function handleBatchFreelancerAction(action: "approve" | "reject") {
    if (selectedActionable.length === 0) return;
    if (action === "reject" && !rejectReason.trim()) {
      toast({ title: "Please enter a rejection reason", variant: "destructive" });
      return;
    }
    setBatchActioning(true);
    try {
      const res = await fetch("/api/admin/freelancer-invoices/batch-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedActionable.map((inv) => inv.id),
          action,
          ...(action === "reject" ? { rejection_reason: rejectReason.trim() } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: `${action === "approve" ? "Approved" : "Rejected"} ${data.updated} invoices`, description: data.skipped ? `${data.skipped} skipped` : undefined });
        setSelectedFreelancerIds(new Set());
        setRejectDialogOpen(false);
        setRejectReason("");
        loadData();
      } else {
        const errMsg = await getApiError(res);
        toast({ title: "Error", description: errMsg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Batch action failed", variant: "destructive" });
    } finally {
      setBatchActioning(false);
    }
  }

  if (loading || !period) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{formatPeriod(period.year, period.month)}</h1>
            {period.status === "open" ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><LockOpen className="h-4 w-4" /> Open</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Locked</span>
            )}
          </div>
          <p className="text-muted-foreground">
            {period.working_days} working days
            {period.submission_deadline && <> &middot; Submit by {period.submission_deadline}</>}
            {period.payment_deadline && <> &middot; Pay by {period.payment_deadline}</>}

            <Badge
              variant={nbrbRate ? "secondary" : "warning"}
              className="ml-2 cursor-pointer"
              onClick={handleFetchNbrbRate}
            >
              {fetchingRate ? "Fetching..." : nbrbRate ? `1 USD = ${nbrbRate} BYN` : "Fetch NBRB Rate"}
            </Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleToggleLock}>
            {period.status === "open" ? "Lock Period" : "Unlock Period"}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete Period"}
          </Button>
          {payrollRecords.length > 0 && (
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          )}
          <Button onClick={handleGenerate} disabled={generating || period.status === "locked"}>
            {generating ? "Generating..." : "Generate Payroll"}
          </Button>
        </div>
      </div>

      {statusFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtering by:</span>
          <Badge variant={statusVariant(statusFilter)} className="gap-1">
            {statusFilter.replace("_", " ")}
            <button onClick={clearStatusFilter} className="ml-1 hover:opacity-70">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="employees">Employees ({filteredPayroll.length})</TabsTrigger>
          <TabsTrigger value="freelancers">Freelancers ({filteredFreelancer.length})</TabsTrigger>
          <TabsTrigger value="compensations">Compensations ({compensations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardContent className="pt-6">
              {filteredPayroll.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2 items-center">
                    {!tableEditMode && selectedSendable.length > 0 && (
                      <Button size="sm" onClick={handleBatchSend} disabled={batchSending}>
                        <Send className="h-3.5 w-3.5 mr-1" />
                        {batchSending ? "Sending..." : `Send ${selectedSendable.length} to Employees`}
                      </Button>
                    )}
                    {!tableEditMode && selectedIds.size > 0 && approvedUsRecords.some((r) => selectedIds.has(r.id)) && entity !== "BY" && (
                      <Button variant="outline" size="sm" onClick={handleBatchDownload} disabled={downloading}>
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {downloading ? "Downloading..." : `Download ${Array.from(selectedIds).filter((id) => approvedUsRecords.some((r) => r.id === id)).length} PDFs`}
                      </Button>
                    )}
                    {!tableEditMode && selectedIds.size > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                        Clear selection
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {tableEditMode ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setTableEditMode(false)} disabled={saving}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveAll} disabled={saving}>
                          {saving ? "Saving..." : "Save All"}
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={enterTableEdit} disabled={period.status === "locked"}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Table Edit
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className={tableEditMode ? "overflow-x-auto" : ""}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {!tableEditMode && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredPayroll.length > 0 && filteredPayroll.every((r) => selectedIds.has(r.id))}
                          onCheckedChange={() => {
                            const allSelected = filteredPayroll.every((r) => selectedIds.has(r.id));
                            if (allSelected) {
                              setSelectedIds(new Set());
                            } else {
                              setSelectedIds(new Set(filteredPayroll.map((r) => r.id)));
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead>Employee</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Prorated</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Comp.</TableHead>
                    <TableHead>Total</TableHead>
                    {!tableEditMode && <TableHead>Status</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayroll.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableEditMode ? 7 : (entity !== "BY" && approvedUsRecords.length > 0 ? 10 : 9)} className="text-center text-muted-foreground py-8">
                        {statusFilter ? "No records match this filter." : "No payroll records yet. Generate payroll to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredPayroll.map((r) => {
                        const ed = editData[r.id];
                        return (
                        <TableRow key={r.id}>
                          {!tableEditMode && (
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(r.id)}
                                onCheckedChange={() => toggleSelect(r.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <Link href={`/admin/payroll/${r.id}`} className="font-medium hover:underline whitespace-nowrap">
                              {r.employee?.first_name} {r.employee?.last_name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {tableEditMode && ed ? (
                              <Input type="number" min={0} max={period.working_days} step={0.5}
                                className="w-16 text-center" value={ed.days_worked}
                                onChange={(e) => updateField(r.id, "days_worked", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} />
                            ) : (
                              <>{r.days_worked}/{period.working_days}</>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(r.gross_salary)}</TableCell>
                          <TableCell>{tableEditMode ? "—" : formatCurrency(r.prorated_gross)}</TableCell>
                          <TableCell>
                            {tableEditMode && ed ? (
                              <Input type="number" min={0} step={0.01} className="w-20"
                                value={ed.bonus}
                                onChange={(e) => updateField(r.id, "bonus", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} />
                            ) : (
                              formatCurrency(r.bonus)
                            )}
                          </TableCell>
                          <TableCell>
                            {tableEditMode && ed ? (
                              <Input type="number" min={0} step={0.01} className="w-20"
                                value={ed.compensation_amount}
                                onChange={(e) => updateField(r.id, "compensation_amount", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)} />
                            ) : (
                              formatCurrency(r.compensation_amount)
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(r.total_amount)}</TableCell>
                          {!tableEditMode && (
                            <TableCell><Badge variant={statusVariant(r.status)}>{r.status.replace("_", " ")}</Badge></TableCell>
                          )}
                        </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-semibold">
                        {!tableEditMode && <TableCell />}
                        <TableCell>Totals ({filteredPayroll.length})</TableCell>
                        <TableCell />
                        <TableCell>{formatCurrency(filteredPayroll.reduce((s, r) => s + r.gross_salary, 0))}</TableCell>
                        <TableCell>{formatCurrency(filteredPayroll.reduce((s, r) => s + r.prorated_gross, 0))}</TableCell>
                        <TableCell>{formatCurrency(filteredPayroll.reduce((s, r) => s + r.bonus, 0))}</TableCell>
                        <TableCell>{formatCurrency(filteredPayroll.reduce((s, r) => s + r.compensation_amount, 0))}</TableCell>
                        <TableCell>{formatCurrency(filteredPayroll.reduce((s, r) => s + r.total_amount, 0))}</TableCell>
                        {!tableEditMode && <TableCell />}
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freelancers">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-2 items-center">
                  {selectedActionable.length > 0 && (
                    <>
                      <Button size="sm" onClick={() => handleBatchFreelancerAction("approve")} disabled={batchActioning}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        {batchActioning ? "Processing..." : `Approve ${selectedActionable.length}`}
                      </Button>
                      {!rejectDialogOpen ? (
                        <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={batchActioning}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject {selectedActionable.length}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Textarea
                            placeholder="Rejection reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="h-9 min-h-[36px] w-64 text-sm"
                          />
                          <Button size="sm" variant="destructive" onClick={() => handleBatchFreelancerAction("reject")} disabled={batchActioning || !rejectReason.trim()}>
                            {batchActioning ? "Rejecting..." : "Confirm Reject"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setRejectDialogOpen(false); setRejectReason(""); }}>
                            Cancel
                          </Button>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setSelectedFreelancerIds(new Set())}>
                        Clear selection
                      </Button>
                    </>
                  )}
                </div>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="all">All payment methods</option>
                  <option value="AMC">AMC</option>
                  <option value="Interexy">Interexy</option>
                  <option value="CRYPTO">CRYPTO</option>
                  <option value="BANK">BANK</option>
                  <option value="PAYONEER">PAYONEER</option>
                </select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allActionableSelected}
                        onCheckedChange={toggleFreelancerSelectAll}
                        disabled={actionableInvoices.length === 0}
                      />
                    </TableHead>
                    <TableHead>Freelancer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFreelancer.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {statusFilter ? "No invoices match this filter." : "No freelancer invoices for this period."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredFreelancer.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            {inv.status === "pending_approval" ? (
                              <Checkbox
                                checked={selectedFreelancerIds.has(inv.id)}
                                onCheckedChange={() => toggleFreelancerSelect(inv.id)}
                              />
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Link href={`/admin/freelancer-invoices/${inv.id}`} className="font-medium hover:underline">
                              {inv.freelancer?.first_name} {inv.freelancer?.last_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{inv.freelancer?.payment_channel || "—"}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(inv.total_amount)}</TableCell>
                          <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status.replace("_", " ")}</Badge></TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell />
                        <TableCell>Totals ({filteredFreelancer.length})</TableCell>
                        <TableCell />
                        <TableCell>{formatCurrency(filteredFreelancer.reduce((s, inv) => s + inv.total_amount, 0))}</TableCell>
                        <TableCell />
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compensations">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
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
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No compensations submitted for this period.
                      </TableCell>
                    </TableRow>
                  ) : compensations.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">
                        {comp.employee?.first_name} {comp.employee?.last_name}
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
                          <button onClick={() => handleReceiptPreview(comp.receipt_url!)} className="text-sm text-primary hover:underline">View</button>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={comp.status === "approved" ? "success" : comp.status === "rejected" ? "destructive" : "warning"}>
                          {comp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {comp.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => {
                              const input = document.getElementById(`comp-amount-${comp.id}`) as HTMLInputElement;
                              const amt = parseFloat(input?.value) || comp.submitted_amount;
                              handleCompensationReview(comp.id, "approved", amt);
                            }}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleCompensationReview(comp.id, "rejected")}>
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {compensations.length > 0 && (
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2}>Totals ({compensations.length})</TableCell>
                      <TableCell className="text-right">{formatCurrency(compensations.reduce((s, c) => s + c.submitted_amount, 0))}</TableCell>
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
        </TabsContent>
      </Tabs>

      <Dialog open={receiptPreviewOpen} onOpenChange={setReceiptPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px]">
            {receiptPreviewLoading ? (
              <Spinner className="h-8 w-8 text-foreground" />
            ) : receiptPreviewUrl ? (
              receiptPreviewPath?.endsWith(".pdf") ? (
                <iframe src={receiptPreviewUrl} className="w-full h-[75vh] rounded" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receiptPreviewUrl} alt="Receipt" className="max-w-full max-h-[75vh] object-contain rounded" />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
