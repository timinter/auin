"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { EmployeeContract, BankAccount } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField, clearFieldError } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatDisplayDate, getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { Plus, Trash2, Star } from "lucide-react";

const emptyBankForm = { label: "", bank_name: "", account_number: "", swift: "", iban: "", routing_number: "", bank_address: "", is_primary: false };

export default function EmployeeProfilePage() {
  const { profile } = useProfile();
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankForm, setBankForm] = useState(emptyBankForm);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankErrors, setBankErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const [personalForm, setPersonalForm] = useState({
    legal_address: "",
    personal_email: "",
    service_description: "",
    invoice_number_seq: 1,
  });

  async function loadBankAccounts() {
    const res = await fetch("/api/profile/bank-accounts");
    if (res.ok) setBankAccounts(await res.json());
  }

  useEffect(() => {
    if (!profile) return;
    setPersonalForm({
      legal_address: profile.legal_address || "",
      personal_email: profile.personal_email || "",
      service_description: profile.service_description || "",
      invoice_number_seq: profile.invoice_number_seq || 1,
    });
    async function loadData() {
      const supabase = createClient();
      const { data } = await supabase
        .from("employee_contracts")
        .select("*")
        .eq("employee_id", profile!.id)
        .order("effective_from", { ascending: false });
      setContracts(data || []);
      await loadBankAccounts();
    }
    loadData();
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setFieldErrors({});

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(personalForm),
    });

    if (res.ok) {
      toast({ title: "Profile updated" });
    } else {
      const d = await res.json();
      if (d.fieldErrors) setFieldErrors(d.fieldErrors);
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleSaveBank() {
    setSavingBank(true);
    setBankErrors({});
    const method = editingBankId ? "PUT" : "POST";
    const body = editingBankId ? { id: editingBankId, ...bankForm } : bankForm;

    const res = await fetch("/api/profile/bank-accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast({ title: editingBankId ? "Bank account updated" : "Bank account added" });
      setBankFormOpen(false);
      setBankForm(emptyBankForm);
      setEditingBankId(null);
      await loadBankAccounts();
    } else {
      const d = await res.json();
      if (d.fieldErrors) setBankErrors(d.fieldErrors);
      else toast({ title: "Error", description: d.error || "Failed to save", variant: "destructive" });
    }
    setSavingBank(false);
  }

  async function handleDeleteBank(id: string) {
    const res = await fetch("/api/profile/bank-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast({ title: "Bank account removed" });
      await loadBankAccounts();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  async function handleSetPrimary(id: string) {
    const account = bankAccounts.find((a) => a.id === id);
    if (!account) return;
    const res = await fetch("/api/profile/bank-accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, label: account.label, bank_name: account.bank_name, account_number: account.account_number, swift: account.swift, iban: account.iban, routing_number: account.routing_number, bank_address: account.bank_address, is_primary: true }),
    });
    if (res.ok) {
      toast({ title: "Primary bank updated" });
      await loadBankAccounts();
    }
  }

  function startEditBank(account: BankAccount) {
    setEditingBankId(account.id);
    setBankForm({
      label: account.label,
      bank_name: account.bank_name,
      account_number: account.account_number,
      swift: account.swift,
      iban: account.iban,
      routing_number: account.routing_number,
      bank_address: account.bank_address,
      is_primary: account.is_primary,
    });
    setBankErrors({});
    setBankFormOpen(true);
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
          <FormField label="Service Description *" error={fieldErrors.service_description} onClearError={clearFieldError(setFieldErrors, "service_description")}>
            <Textarea value={personalForm.service_description} onChange={(e) => setPersonalForm({ ...personalForm, service_description: e.target.value })} placeholder="e.g. Software development services" rows={2} required />
          </FormField>
          <div>
            <FormField label="Invoice Starting Number" error={fieldErrors.invoice_number_seq} onClearError={clearFieldError(setFieldErrors, "invoice_number_seq")}>
              <Input type="number" min={1} value={personalForm.invoice_number_seq} onChange={(e) => setPersonalForm({ ...personalForm, invoice_number_seq: parseInt(e.target.value) || 1 })} />
            </FormField>
            <p className="text-xs text-muted-foreground mt-1">Your next invoice will be numbered N{personalForm.invoice_number_seq}. It auto-increments after each download.</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bank Accounts</CardTitle>
            {!bankFormOpen && bankAccounts.length < 5 && (
              <Button size="sm" variant="outline" onClick={() => { setBankForm(emptyBankForm); setEditingBankId(null); setBankErrors({}); setBankFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Bank Account
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {bankAccounts.length === 0 && !bankFormOpen && (
            <p className="text-sm text-muted-foreground">No bank accounts added yet.</p>
          )}

          {bankAccounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between border rounded-lg p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{account.label}</span>
                  {account.is_primary && <Badge variant="default" className="text-[10px] px-1.5 py-0">Primary</Badge>}
                </div>
                {account.bank_name && <p className="text-sm text-muted-foreground">{account.bank_name}</p>}
                {account.iban && (
                  <p className="text-xs text-muted-foreground font-mono">
                    IBAN: {account.iban.slice(0, 6)}...{account.iban.slice(-4)}
                  </p>
                )}
                {account.account_number && !account.iban && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Acct: ...{account.account_number.slice(-4)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!account.is_primary && (
                  <Button size="sm" variant="ghost" onClick={() => handleSetPrimary(account.id)} title="Set as primary">
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEditBank(account)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteBank(account.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {bankFormOpen && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">{editingBankId ? "Edit Bank Account" : "Add Bank Account"}</p>
              <FormField label="Label" error={bankErrors.label} onClearError={clearFieldError(setBankErrors, "label")}>
                <Input value={bankForm.label} onChange={(e) => setBankForm({ ...bankForm, label: e.target.value })} placeholder="e.g. Main Bank, EUR Account" />
              </FormField>
              <FormField label="Bank Name" error={bankErrors.bank_name} onClearError={clearFieldError(setBankErrors, "bank_name")}>
                <Input value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} />
              </FormField>
              <FormField label="Account Number" error={bankErrors.account_number} onClearError={clearFieldError(setBankErrors, "account_number")}>
                <Input value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="SWIFT" error={bankErrors.swift} onClearError={clearFieldError(setBankErrors, "swift")}>
                  <Input value={bankForm.swift} onChange={(e) => setBankForm({ ...bankForm, swift: e.target.value })} />
                </FormField>
                <FormField label="IBAN" error={bankErrors.iban} onClearError={clearFieldError(setBankErrors, "iban")}>
                  <Input value={bankForm.iban} onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })} />
                </FormField>
              </div>
              <FormField label="Routing Number" error={bankErrors.routing_number} onClearError={clearFieldError(setBankErrors, "routing_number")}>
                <Input value={bankForm.routing_number} onChange={(e) => setBankForm({ ...bankForm, routing_number: e.target.value })} />
              </FormField>
              <FormField label="Bank Address" error={bankErrors.bank_address} onClearError={clearFieldError(setBankErrors, "bank_address")}>
                <Input value={bankForm.bank_address} onChange={(e) => setBankForm({ ...bankForm, bank_address: e.target.value })} />
              </FormField>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveBank} disabled={savingBank || !bankForm.label.trim()}>
                  {savingBank ? "Saving..." : editingBankId ? "Update" : "Add"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setBankFormOpen(false); setEditingBankId(null); setBankForm(emptyBankForm); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
