"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { useRouter } from "next/navigation";
import type { PayrollPeriod, FreelancerProjectRate, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { Upload, Trash2, Plus } from "lucide-react";

interface ProjectLine {
  project_id: string;
  project_name: string;
  hourly_rate: number;
  hours: number;
}

interface BonusLine {
  id: string;
  description: string;
  amount: number;
}

export default function NewInvoicePage() {
  const { profile } = useProfile();
  const router = useRouter();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [, setRates] = useState<(FreelancerProjectRate & { project: Project })[]>([]);
  const [lines, setLines] = useState<ProjectLine[]>([]);
  const [bonusLines, setBonusLines] = useState<BonusLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [invoiceFileUrl, setInvoiceFileUrl] = useState<string | null>(null);
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null);
  const [timeReportUrl, setTimeReportUrl] = useState<string | null>(null);
  const [timeReportName, setTimeReportName] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const supabase = createClient();

      const { data: p } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("status", "open")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      setPeriods(p || []);

      const { data: r } = await supabase
        .from("freelancer_project_rates")
        .select("*, project:projects(*)")
        .eq("freelancer_id", profile!.id)
        .is("effective_to", null);
      setRates(r || []);

      if (r) {
        setLines(
          r.map((rate) => ({
            project_id: rate.project_id,
            project_name: rate.project?.name || "",
            hourly_rate: rate.hourly_rate,
            hours: 0,
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [profile]);

  const projectTotal = useMemo(() => {
    return lines.reduce((sum, l) => sum + l.hours * l.hourly_rate, 0);
  }, [lines]);

  const bonusTotal = useMemo(() => {
    return bonusLines.reduce((sum, l) => sum + l.amount, 0);
  }, [bonusLines]);

  const grandTotal = projectTotal + bonusTotal;

  const profileMissing = useMemo(() => {
    if (!profile) return [];
    const missing: string[] = [];
    if (!profile.service_description) missing.push("Service Description");
    if (!profile.personal_email) missing.push("Personal Email");
    if (!profile.legal_address) missing.push("Legal Address");
    const bank = profile.bank_details || {};
    if (!bank.bank_name) missing.push("Bank Name");
    if (!bank.account_number) missing.push("Account Number");
    if (!bank.swift) missing.push("SWIFT");
    if (!bank.iban) missing.push("IBAN");
    if (!bank.bank_address) missing.push("Bank Address");
    return missing;
  }, [profile]);

  function updateHours(projectId: string, hours: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.project_id === projectId ? { ...l, hours: parseFloat(hours) || 0 } : l
      )
    );
  }

  function addBonusLine() {
    setBonusLines((prev) => [...prev, { id: crypto.randomUUID(), description: "", amount: 0 }]);
  }

  function updateBonusLine(id: string, field: "description" | "amount", value: string) {
    setBonusLines((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, [field]: field === "amount" ? parseFloat(value) || 0 : value }
          : l
      )
    );
  }

  function removeBonusLine(id: string) {
    setBonusLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function handleFileUpload(fileType: "invoice" | "time_report", file: File) {
    setUploading(fileType);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", fileType);

    try {
      const res = await fetch("/api/freelancer/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const errMsg = await getApiError(res);
        toast({ title: "Upload failed", description: errMsg, variant: "destructive" });
        return;
      }
      const data = await res.json();
      if (fileType === "invoice") {
        setInvoiceFileUrl(data.url);
        setInvoiceFileName(file.name);
      } else {
        setTimeReportUrl(data.url);
        setTimeReportName(file.name);
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit(submit: boolean) {
    if (!selectedPeriod) {
      toast({ title: "Please select a period", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/freelancer/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_id: selectedPeriod,
        lines: lines.filter((l) => l.hours > 0).map((l) => ({
          project_id: l.project_id,
          hours: l.hours,
        })),
        bonus_lines: bonusLines
          .filter((l) => l.description && l.amount > 0)
          .map((l) => ({ description: l.description, amount: l.amount })),
        invoice_file_url: invoiceFileUrl,
        time_report_url: timeReportUrl,
        submit,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      toast({ title: submit ? "Invoice submitted for review" : "Draft saved" });
      router.push(`/freelancer/invoices/${data.id}`);
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
    setSubmitting(false);
  }

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Submit Hours</h1>

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
        {selectedPeriod && (() => {
          const p = periods.find((p) => p.id === selectedPeriod);
          return p?.submission_deadline ? (
            <p className="text-sm text-muted-foreground mt-1">Submission deadline: {p.submission_deadline}</p>
          ) : null;
        })()}
      </div>

      <Card>
        <CardHeader><CardTitle>Project Hours</CardTitle></CardHeader>
        <CardContent>
          {lines.length === 0 ? (
            <p className="text-muted-foreground">No projects assigned. Contact admin.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="w-32">Hours</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.project_id}>
                    <TableCell className="font-medium">{line.project_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(line.hourly_rate)}/hr</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        value={line.hours || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateHours(line.project_id, e.target.value)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(line.hours * line.hourly_rate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {bonusLines.length === 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-semibold">Subtotal</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(projectTotal)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bonus Items</CardTitle>
          <Button variant="outline" size="sm" onClick={addBonusLine}>
            <Plus className="h-4 w-4 mr-1" /> Add Bonus
          </Button>
        </CardHeader>
        <CardContent>
          {bonusLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bonus items. Click &quot;Add Bonus&quot; to add one.</p>
          ) : (
            <div className="space-y-3">
              {bonusLines.map((bonus) => (
                <div key={bonus.id} className="flex items-center gap-3">
                  <Input
                    placeholder="Description"
                    value={bonus.description}
                    onChange={(e) => updateBonusLine(bonus.id, "description", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Amount"
                    value={bonus.amount || ""}
                    onChange={(e) => updateBonusLine(bonus.id, "amount", e.target.value)}
                    className="w-32"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeBonusLine(bonus.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(bonusLines.length > 0 || projectTotal > 0) && (
        <div className="text-right text-lg font-bold">
          Grand Total: {formatCurrency(grandTotal)}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Time Report (required for submission)</Label>
            {timeReportName ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">{timeReportName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setTimeReportUrl(null); setTimeReportName(null); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading === "time_report"}>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading === "time_report" ? "Uploading..." : "Upload Time Report"}
                  </span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload("time_report", f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Invoice File (optional — upload your own or auto-generate)</Label>
            {invoiceFileName ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">{invoiceFileName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setInvoiceFileUrl(null); setInvoiceFileName(null); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading === "invoice"}>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading === "invoice" ? "Uploading..." : "Upload Invoice"}
                  </span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload("invoice", f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {profileMissing.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-yellow-800">
              Please complete your profile before submitting. Missing: {profileMissing.join(", ")}
            </p>
            <a href="/freelancer/profile" className="text-sm text-primary hover:underline mt-1 inline-block">
              Go to Profile
            </a>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => handleSubmit(false)} disabled={submitting}>
          Save Draft
        </Button>
        <Button onClick={() => handleSubmit(true)} disabled={submitting || grandTotal === 0 || profileMissing.length > 0}>
          {submitting ? "Submitting..." : "Submit for Review"}
        </Button>
      </div>
    </div>
  );
}
