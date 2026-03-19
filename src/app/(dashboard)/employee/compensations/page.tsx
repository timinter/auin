"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { PayrollPeriod, CompensationCategory, EmployeeCompensation } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { Trash2, Upload } from "lucide-react";

export default function EmployeeCompensationsPage() {
  const { profile } = useProfile();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [categories, setCategories] = useState<CompensationCategory[]>([]);
  const [compensations, setCompensations] = useState<EmployeeCompensation[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Form state
  const [selectedCategory, setSelectedCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const supabase = createClient();

      const [{ data: p }, { data: c }] = await Promise.all([
        supabase
          .from("payroll_periods")
          .select("*")
          .eq("status", "open")
          .order("year", { ascending: false })
          .order("month", { ascending: false }),
        supabase
          .from("compensation_categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
      ]);

      setPeriods(p || []);
      setCategories(c || []);
      if (p && p.length > 0) setSelectedPeriod(p[0].id);
      setLoading(false);
    }
    load();
  }, [profile]);

  const loadCompensations = useCallback(async () => {
    if (!selectedPeriod) return;
    const res = await fetch(`/api/employee/compensations?period_id=${selectedPeriod}`);
    if (res.ok) {
      const data = await res.json();
      setCompensations(data);
    }
  }, [selectedPeriod]);

  useEffect(() => { loadCompensations(); }, [loadCompensations]);

  async function handleUploadReceipt(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/employee/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setReceiptUrl(data.url);
        setReceiptName(file.name);
      } else {
        const errMsg = await getApiError(res);
        toast({ title: "Upload failed", description: errMsg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!selectedPeriod || !selectedCategory || !amount) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/employee/compensations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_id: selectedPeriod,
        category_id: selectedCategory,
        submitted_amount: parseFloat(amount),
        submitted_currency: "BYN",
        receipt_date: receiptDate || undefined,
        receipt_url: receiptUrl,
      }),
    });

    if (res.ok) {
      toast({ title: "Compensation submitted" });
      setAmount("");
      setSelectedCategory("");
      setReceiptDate("");
      setReceiptUrl(null);
      setReceiptName(null);
      loadCompensations();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/employee/compensations/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Deleted" });
      loadCompensations();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
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
      <h1 className="text-2xl font-bold">My Compensations</h1>

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
        <CardHeader><CardTitle>Submit Compensation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                      {c.limit_percentage && ` (${c.limit_percentage}% covered)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (BYN)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Receipt Date</Label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
          </div>

          {selectedCategory && (() => {
            const cat = categories.find((c) => c.id === selectedCategory);
            if (!cat) return null;
            return (
              <div className="text-sm text-muted-foreground space-y-1">
                {cat.limit_percentage && <p>Company covers {cat.limit_percentage}% of your expense</p>}
                {cat.max_gross && <p>Monthly cap: {formatCurrency(cat.max_gross)} (gross)</p>}
                {cat.annual_max_gross && <p>Annual cap: {formatCurrency(cat.annual_max_gross)} (gross)</p>}
                {cat.is_prorated && <p>Amount is prorated across the year</p>}
              </div>
            );
          })()}

          <div>
            <Label className="mb-2 block">Receipt</Label>
            {receiptName ? (
              <div className="flex items-center gap-2">
                <span className="text-sm">{receiptName}</span>
                <Button variant="ghost" size="sm" onClick={() => { setReceiptUrl(null); setReceiptName(null); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    {uploading ? "Uploading..." : "Upload Receipt"}
                  </span>
                </Button>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadReceipt(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !selectedCategory || !amount}>
            {submitting ? "Submitting..." : "Submit Compensation"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Submitted Compensations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Submitted</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {compensations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No compensations submitted for this period
                  </TableCell>
                </TableRow>
              ) : compensations.map((comp) => (
                <TableRow key={comp.id}>
                  <TableCell className="font-medium">{comp.category?.label || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(comp.submitted_amount)}</TableCell>
                  <TableCell className="text-right">
                    {comp.approved_amount != null ? formatCurrency(comp.approved_amount) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(comp.status)}>{comp.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {comp.status === "pending" && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(comp.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
