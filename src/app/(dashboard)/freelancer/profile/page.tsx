"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { FreelancerProjectRate, Project, BankDetails } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField, clearFieldError } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";

export default function FreelancerProfilePage() {
  const { profile } = useProfile();
  const [rates, setRates] = useState<(FreelancerProjectRate & { project: Project })[]>([]);
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
    service_description: "",
    payment_channel: "" as string,
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
      service_description: profile.service_description || "",
      payment_channel: profile.payment_channel || "",
    });
    async function loadRates() {
      const supabase = createClient();
      const { data } = await supabase
        .from("freelancer_project_rates")
        .select("*, project:projects(*)")
        .eq("freelancer_id", profile!.id)
        .is("effective_to", null);
      setRates(data || []);
    }
    loadRates();
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
          {profile.contract_start_date && (
            <div className="flex justify-between"><span className="text-muted-foreground">Contract Start</span><span>{profile.contract_start_date}</span></div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contact & Address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Personal Email" error={fieldErrors.personal_email} onClearError={clearFieldError(setFieldErrors, "personal_email")}>
            <Input type="email" value={personalForm.personal_email} onChange={(e) => setPersonalForm({ ...personalForm, personal_email: e.target.value })} placeholder="Your personal email" />
          </FormField>
          <FormField label="Legal Address" error={fieldErrors.legal_address} onClearError={clearFieldError(setFieldErrors, "legal_address")}>
            <Input value={personalForm.legal_address} onChange={(e) => setPersonalForm({ ...personalForm, legal_address: e.target.value })} placeholder="Your legal address" />
          </FormField>
          <FormField label="Service Description" error={fieldErrors.service_description} onClearError={clearFieldError(setFieldErrors, "service_description")}>
            <Textarea value={personalForm.service_description} onChange={(e) => setPersonalForm({ ...personalForm, service_description: e.target.value })} placeholder="Description of services you provide (required for invoice submission)" rows={3} />
          </FormField>
          <FormField label="Payment Method">
            <Select value={personalForm.payment_channel} onValueChange={(v) => setPersonalForm({ ...personalForm, payment_channel: v })}>
              <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">Bank Transfer</SelectItem>
                <SelectItem value="CRYPTO">Crypto</SelectItem>
                <SelectItem value="PAYONEER">Payoneer</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Assigned Projects & Rates</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>From</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No projects assigned</TableCell></TableRow>
              ) : rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.project?.name}</TableCell>
                  <TableCell>{formatCurrency(r.hourly_rate)}/hr</TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell>{r.effective_from}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </div>
  );
}
