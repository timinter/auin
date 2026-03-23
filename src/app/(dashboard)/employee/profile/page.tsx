"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { EmployeeContract, BankDetails, PaymentSplit } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField, clearFieldError } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDisplayDate, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { Plus, Trash2 } from "lucide-react";

export default function EmployeeProfilePage() {
  const { profile } = useProfile();
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [splits, setSplits] = useState<{ payment_channel: string; percentage: number }[]>([]);
  const [savingSplits, setSavingSplits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const [bank, setBank] = useState<BankDetails>({
    bank_name: "",
    account_number: "",
    swift: "",
    iban: "",
    bank_address: "",
  });

  const [personalForm, setPersonalForm] = useState({
    legal_address: "",
    personal_email: "",
  });

  useEffect(() => {
    if (!profile) return;
    setBank({
      bank_name: profile.bank_details?.bank_name || "",
      account_number: profile.bank_details?.account_number || "",
      swift: profile.bank_details?.swift || "",
      iban: profile.bank_details?.iban || "",
      bank_address: profile.bank_details?.bank_address || "",
    });
    setPersonalForm({
      legal_address: profile.legal_address || "",
      personal_email: profile.personal_email || "",
    });
    async function loadData() {
      const supabase = createClient();
      const { data } = await supabase
        .from("employee_contracts")
        .select("*")
        .eq("employee_id", profile!.id)
        .order("effective_from", { ascending: false });
      setContracts(data || []);

      // Load payment splits
      const splitsRes = await fetch("/api/profile/splits");
      if (splitsRes.ok) {
        const splitsData = await splitsRes.json();
        if (splitsData.length > 0) {
          setSplits(splitsData.map((s: PaymentSplit) => ({
            payment_channel: s.payment_channel,
            percentage: s.percentage,
          })));
        }
      }
    }
    loadData();
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setFieldErrors({});

    const [bankRes, profileRes] = await Promise.all([
      fetch("/api/profile/bank-details", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bank),
      }),
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personalForm),
      }),
    ]);

    if (bankRes.ok && profileRes.ok) {
      toast({ title: "Profile updated" });
    } else {
      const errors: Record<string, string> = {};
      if (!bankRes.ok) {
        const d = await bankRes.json();
        if (d.fieldErrors) Object.assign(errors, d.fieldErrors);
      }
      if (!profileRes.ok) {
        const d = await profileRes.json();
        if (d.fieldErrors) Object.assign(errors, d.fieldErrors);
      }
      setFieldErrors(errors);
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
    }
    setSaving(false);
  }

  if (!profile) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{profile.first_name} {profile.last_name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{profile.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Department</span><span>{profile.department || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Payment Channel</span><span>{profile.payment_channel || "—"}</span></div>
          {profile.contract_start_date && (
            <div className="flex justify-between"><span className="text-muted-foreground">Contract Start</span><span>{formatDisplayDate(profile.contract_start_date)}</span></div>
          )}
          {profile.service_description && (
            <div className="flex justify-between"><span className="text-muted-foreground">Service Description</span><span className="text-right max-w-[60%]">{profile.service_description}</span></div>
          )}
        </CardContent>
      </Card>

      {contracts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Contract History</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => {
                  const isActive = !c.effective_to && !c.terminated_at;
                  const isTerminated = !!c.terminated_at;
                  return (
                    <TableRow key={c.id} className={isTerminated ? "opacity-50" : ""}>
                      <TableCell>
                        <Badge variant={c.contract_type === "primary" ? "default" : "secondary"}>
                          {c.contract_type || "primary"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(c.gross_salary)}</TableCell>
                      <TableCell>{formatDisplayDate(c.effective_from)}</TableCell>
                      <TableCell>{c.effective_to ? formatDisplayDate(c.effective_to) : "—"}</TableCell>
                      <TableCell>
                        {isTerminated ? (
                          <Badge variant="destructive">Terminated</Badge>
                        ) : isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="outline">Ended</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Contact & Address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Personal Email" error={fieldErrors.personal_email} onClearError={clearFieldError(setFieldErrors, "personal_email")}>
            <Input type="email" value={personalForm.personal_email} onChange={(e) => setPersonalForm({ ...personalForm, personal_email: e.target.value })} placeholder="Your personal email" />
          </FormField>
          <FormField label="Legal Address" error={fieldErrors.legal_address} onClearError={clearFieldError(setFieldErrors, "legal_address")}>
            <Input value={personalForm.legal_address} onChange={(e) => setPersonalForm({ ...personalForm, legal_address: e.target.value })} placeholder="Your legal address" />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Bank Name" error={fieldErrors.bank_name} onClearError={clearFieldError(setFieldErrors, "bank_name")}>
            <Input value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} />
          </FormField>
          <FormField label="Account Number" error={fieldErrors.account_number} onClearError={clearFieldError(setFieldErrors, "account_number")}>
            <Input value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="SWIFT" error={fieldErrors.swift} onClearError={clearFieldError(setFieldErrors, "swift")}>
              <Input value={bank.swift} onChange={(e) => setBank({ ...bank, swift: e.target.value })} />
            </FormField>
            <FormField label="IBAN" error={fieldErrors.iban} onClearError={clearFieldError(setFieldErrors, "iban")}>
              <Input value={bank.iban} onChange={(e) => setBank({ ...bank, iban: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Bank Address" error={fieldErrors.bank_address} onClearError={clearFieldError(setFieldErrors, "bank_address")}>
            <Input value={bank.bank_address} onChange={(e) => setBank({ ...bank, bank_address: e.target.value })} />
          </FormField>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Splits</CardTitle>
            {splits.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSplits([{ payment_channel: profile.payment_channel || "BANK", percentage: 100 }])}
              >
                <Plus className="h-4 w-4 mr-1" /> Configure Splits
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {splits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payment splits configured. Your full salary is paid via {profile.payment_channel || "your default channel"}.
            </p>
          ) : (
            <>
              {splits.map((split, idx) => (
                <div key={idx} className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium">Channel</label>
                    <Select
                      value={split.payment_channel}
                      onValueChange={(v) => {
                        const next = [...splits];
                        next[idx] = { ...next[idx], payment_channel: v };
                        setSplits(next);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BANK">Bank Transfer</SelectItem>
                        <SelectItem value="CRYPTO">Crypto</SelectItem>
                        <SelectItem value="PAYONEER">Payoneer</SelectItem>
                        <SelectItem value="AMC">AMC</SelectItem>
                        <SelectItem value="Interexy">Interexy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <label className="text-sm font-medium">%</label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={split.percentage}
                      onChange={(e) => {
                        const next = [...splits];
                        next[idx] = { ...next[idx], percentage: parseFloat(e.target.value) || 0 };
                        setSplits(next);
                      }}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {(() => {
                const total = splits.reduce((s, sp) => s + sp.percentage, 0);
                return total !== 100 && (
                  <p className="text-sm text-destructive">Total: {total}% — must equal 100%</p>
                );
              })()}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSplits([...splits, { payment_channel: "BANK", percentage: 0 }])}
                  disabled={splits.length >= 5}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Split
                </Button>
                <Button
                  size="sm"
                  disabled={savingSplits || splits.reduce((s, sp) => s + sp.percentage, 0) !== 100}
                  onClick={async () => {
                    setSavingSplits(true);
                    const res = await fetch("/api/profile/splits", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ splits }),
                    });
                    if (res.ok) {
                      toast({ title: "Payment splits saved" });
                    } else {
                      const errMsg = await getApiError(res);
                      toast({ title: "Error", description: errMsg, variant: "destructive" });
                    }
                    setSavingSplits(false);
                  }}
                >
                  {savingSplits ? "Saving..." : "Save Splits"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await fetch("/api/profile/splits", { method: "DELETE" });
                    setSplits([]);
                    toast({ title: "Splits removed" });
                  }}
                >
                  Remove Splits
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
