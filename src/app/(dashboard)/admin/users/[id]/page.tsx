"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, EmployeeContract, FreelancerProjectRate, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormField, clearFieldError } from "@/components/ui/form-field";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { PageSpinner } from "@/components/spinner";
import { ENTITIES, ENTITY_LABELS } from "@/lib/hooks/use-entity";
import { Textarea } from "@/components/ui/textarea";

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [rates, setRates] = useState<(FreelancerProjectRate & { project: Project })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState<string | null>(null);
  const [terminateForm, setTerminateForm] = useState({ terminated_at: "", notes: "" });
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [newContract, setNewContract] = useState({ gross_salary: "", effective_from: "", contract_type: "primary", notes: "" });
  const [newRate, setNewRate] = useState({ project_id: "", hourly_rate: "", effective_from: "" });
  const [editingRate, setEditingRate] = useState<(FreelancerProjectRate & { project: Project }) | null>(null);
  const [editRateForm, setEditRateForm] = useState({ hourly_rate: "", effective_from: "", effective_to: "" });

  // Field errors per form section
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [contractErrors, setContractErrors] = useState<Record<string, string>>({});
  const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
  const [editRateErrors, setEditRateErrors] = useState<Record<string, string>>({});

  const { toast } = useToast();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    department: "",
    payment_channel: "",
    status: "",
    role: "",
    entity: "US" as string,
    contract_start_date: "",
    legal_address: "",
    personal_email: "",
    service_description: "",
    invoice_number_prefix: "",
    invoice_number_seq: 1,
    contract_date: "",
  });

  const loadData = useCallback(async () => {
    const supabase = createClient();

    // Fetch profile and projects in parallel (projects are independent)
    const [profileResult, projectsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", params.id).single(),
      supabase.from("projects").select("*").eq("status", "active"),
    ]);

    setProjects(projectsResult.data || []);

    const p = profileResult.data;
    if (p) {
      setProfile(p);
      setForm({
        first_name: p.first_name,
        last_name: p.last_name,
        department: p.department || "",
        payment_channel: p.payment_channel || "",
        status: p.status,
        role: p.role,
        entity: p.entity || "US",
        contract_start_date: p.contract_start_date || "",
        legal_address: p.legal_address || "",
        personal_email: p.personal_email || "",
        service_description: p.service_description || "",
        invoice_number_prefix: p.invoice_number_prefix || "",
        invoice_number_seq: p.invoice_number_seq || 1,
        contract_date: p.contract_date || "",
      });

      if (p.role === "employee") {
        const { data: c } = await supabase
          .from("employee_contracts")
          .select("*")
          .eq("employee_id", params.id)
          .order("effective_from", { ascending: false });
        setContracts(c || []);
      }

      if (p.role === "freelancer") {
        const { data: r } = await supabase
          .from("freelancer_project_rates")
          .select("*, project:projects(*)")
          .eq("freelancer_id", params.id)
          .order("effective_from", { ascending: false });
        setRates(r || []);
      }
    }

    setLoading(false);
  }, [params.id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSave() {
    setSaving(true);
    setProfileErrors({});
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast({ title: "Profile updated" });
      loadData();
    } else {
      const data = await res.json();
      if (data.fieldErrors) setProfileErrors(data.fieldErrors);
      toast({ title: "Please fix the highlighted fields", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleAddContract() {
    setContractErrors({});
    const res = await fetch("/api/admin/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employee_id: params.id,
        gross_salary: parseFloat(newContract.gross_salary),
        effective_from: newContract.effective_from,
        contract_type: newContract.contract_type,
        notes: newContract.notes || null,
      }),
    });
    if (res.ok) {
      toast({ title: "Contract added" });
      setContractDialogOpen(false);
      setNewContract({ gross_salary: "", effective_from: "", contract_type: "primary", notes: "" });
      loadData();
    } else {
      const data = await res.json();
      if (data.fieldErrors) setContractErrors(data.fieldErrors);
      else toast({ title: "Error", description: data.error, variant: "destructive" });
    }
  }

  async function handleTerminateContract() {
    if (!terminateDialogOpen) return;
    const res = await fetch(`/api/admin/contracts/${terminateDialogOpen}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(terminateForm),
    });
    if (res.ok) {
      toast({ title: "Contract terminated" });
      setTerminateDialogOpen(null);
      setTerminateForm({ terminated_at: "", notes: "" });
      loadData();
    } else {
      const data = await res.json();
      toast({ title: "Error", description: data.error, variant: "destructive" });
    }
  }

  async function handleAddRate() {
    setRateErrors({});
    const res = await fetch("/api/admin/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        freelancer_id: params.id,
        project_id: newRate.project_id,
        hourly_rate: parseFloat(newRate.hourly_rate),
        effective_from: newRate.effective_from,
      }),
    });
    if (res.ok) {
      toast({ title: "Rate assigned" });
      setRateDialogOpen(false);
      setNewRate({ project_id: "", hourly_rate: "", effective_from: "" });
      loadData();
    } else {
      const data = await res.json();
      if (data.fieldErrors) setRateErrors(data.fieldErrors);
      else toast({ title: "Error", description: data.error, variant: "destructive" });
    }
  }

  async function handleEditRate() {
    if (!editingRate) return;
    setEditRateErrors({});
    const res = await fetch(`/api/admin/rates/${editingRate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hourly_rate: parseFloat(editRateForm.hourly_rate),
        effective_from: editRateForm.effective_from,
        effective_to: editRateForm.effective_to || null,
      }),
    });
    if (res.ok) {
      toast({ title: "Rate updated" });
      setEditingRate(null);
      loadData();
    } else {
      const data = await res.json();
      if (data.fieldErrors) setEditRateErrors(data.fieldErrors);
      else toast({ title: "Error", description: data.error, variant: "destructive" });
    }
  }

  async function handleDeleteRate(rateId: string) {
    if (!confirm("Delete this rate?")) return;
    const res = await fetch(`/api/admin/rates/${rateId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Rate deleted" });
      loadData();
    } else {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  }

  if (loading || !profile) return <PageSpinner />;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">{profile.first_name} {profile.last_name}</h1>

      <Card>
        <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="First Name" error={profileErrors.first_name} onClearError={clearFieldError(setProfileErrors, "first_name")}>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </FormField>
            <FormField label="Last Name" error={profileErrors.last_name} onClearError={clearFieldError(setProfileErrors, "last_name")}>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
              {profileErrors.role && <p className="text-xs text-destructive mt-1">{profileErrors.role}</p>}
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Delivery">Delivery</SelectItem>
                  <SelectItem value="HR / Sourcer">HR / Sourcer</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Leadgen">Leadgen</SelectItem>
                  <SelectItem value="Administrative">Administrative</SelectItem>
                </SelectContent>
              </Select>
              {profileErrors.department && <p className="text-xs text-destructive mt-1">{profileErrors.department}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Payment Channel</Label>
              <Select value={form.payment_channel} onValueChange={(v) => setForm({ ...form, payment_channel: v })}>
                <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMC">AMC (Belarus)</SelectItem>
                  <SelectItem value="Interexy">Interexy (US)</SelectItem>
                  <SelectItem value="CRYPTO">Crypto</SelectItem>
                  <SelectItem value="BANK">Bank Transfer</SelectItem>
                  <SelectItem value="PAYONEER">Payoneer</SelectItem>
                </SelectContent>
              </Select>
              {profileErrors.payment_channel && <p className="text-xs text-destructive mt-1">{profileErrors.payment_channel}</p>}
            </div>
            <div>
              <Label>Entity</Label>
              <Select value={form.entity} onValueChange={(v) => setForm({ ...form, entity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITIES
                    .filter((e) => profile?.role !== "freelancer" || e !== "BY")
                    .map((e) => (
                    <SelectItem key={e} value={e}>{ENTITY_LABELS[e]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {profileErrors.entity && <p className="text-xs text-destructive mt-1">{profileErrors.entity}</p>}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {profileErrors.status && <p className="text-xs text-destructive mt-1">{profileErrors.status}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contract Start Date" error={profileErrors.contract_start_date} onClearError={clearFieldError(setProfileErrors, "contract_start_date")}>
              <Input type="date" value={form.contract_start_date} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
            </FormField>
            <FormField label="Personal Email" error={profileErrors.personal_email} onClearError={clearFieldError(setProfileErrors, "personal_email")}>
              <Input type="email" value={form.personal_email} onChange={(e) => setForm({ ...form, personal_email: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Legal Address" error={profileErrors.legal_address} onClearError={clearFieldError(setProfileErrors, "legal_address")}>
            <Input value={form.legal_address} onChange={(e) => setForm({ ...form, legal_address: e.target.value })} placeholder="Personal legal address" />
          </FormField>
          <FormField label="Service Description (as per contract)" error={profileErrors.service_description} onClearError={clearFieldError(setProfileErrors, "service_description")}>
            <Textarea value={form.service_description} onChange={(e) => setForm({ ...form, service_description: e.target.value })} placeholder="e.g. Software development services" rows={2} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Invoice Number Prefix" error={profileErrors.invoice_number_prefix} onClearError={clearFieldError(setProfileErrors, "invoice_number_prefix")}>
              <Input value={form.invoice_number_prefix} onChange={(e) => setForm({ ...form, invoice_number_prefix: e.target.value })} placeholder="e.g. INV, IX-US" />
            </FormField>
            <FormField label="Invoice Starting Number">
              <Input type="number" min={1} value={form.invoice_number_seq} onChange={(e) => setForm({ ...form, invoice_number_seq: parseInt(e.target.value) || 1 })} />
            </FormField>
          </div>
          <FormField label="Contract Date (Dated)">
            <Input type="date" value={form.contract_date} onChange={(e) => setForm({ ...form, contract_date: e.target.value })} />
          </FormField>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {profile.role === "employee" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Contracts</CardTitle>
            <Dialog open={contractDialogOpen} onOpenChange={(open) => { setContractDialogOpen(open); if (!open) setContractErrors({}); }}>
              <Button size="sm" onClick={() => setContractDialogOpen(true)}>Add Contract</Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Contract</DialogTitle>
                  <DialogDescription>Set gross salary, type, and effective date.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Contract Type</Label>
                    <Select value={newContract.contract_type} onValueChange={(v) => setNewContract({ ...newContract, contract_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="amendment">Amendment</SelectItem>
                        <SelectItem value="bonus">Bonus</SelectItem>
                        <SelectItem value="part_time">Part-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FormField label="Gross Salary (USD)" error={contractErrors.gross_salary} onClearError={clearFieldError(setContractErrors, "gross_salary")}>
                    <Input type="number" value={newContract.gross_salary} onFocus={(e) => e.target.select()} onChange={(e) => setNewContract({ ...newContract, gross_salary: e.target.value })} />
                  </FormField>
                  <FormField label="Effective From" error={contractErrors.effective_from} onClearError={clearFieldError(setContractErrors, "effective_from")}>
                    <Input type="date" value={newContract.effective_from} onChange={(e) => setNewContract({ ...newContract, effective_from: e.target.value })} />
                  </FormField>
                  <FormField label="Notes (optional)" error={contractErrors.notes} onClearError={clearFieldError(setContractErrors, "notes")}>
                    <Textarea value={newContract.notes} onChange={(e) => setNewContract({ ...newContract, notes: e.target.value })} placeholder="e.g. Salary increase, role change" rows={2} />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddContract}>Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Gross Salary</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell>{c.effective_from}</TableCell>
                      <TableCell>{c.effective_to || "—"}</TableCell>
                      <TableCell>
                        {isTerminated ? (
                          <Badge variant="destructive">Terminated {c.terminated_at}</Badge>
                        ) : isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="outline">Ended</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setTerminateDialogOpen(c.id);
                              setTerminateForm({ terminated_at: new Date().toISOString().split("T")[0], notes: "" });
                            }}
                          >
                            Terminate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {contracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                      No contracts yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {contracts.some((c) => c.notes) && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Notes</p>
                {contracts.filter((c) => c.notes).map((c) => (
                  <div key={c.id} className="text-sm bg-muted/50 rounded p-2">
                    <span className="font-medium">{c.effective_from}:</span> {c.notes}
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <Dialog open={!!terminateDialogOpen} onOpenChange={(open) => { if (!open) setTerminateDialogOpen(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Terminate Contract</DialogTitle>
                <DialogDescription>This will end the contract and mark it as terminated.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <FormField label="Termination Date">
                  <Input type="date" value={terminateForm.terminated_at} onChange={(e) => setTerminateForm({ ...terminateForm, terminated_at: e.target.value })} />
                </FormField>
                <FormField label="Reason (optional)">
                  <Textarea value={terminateForm.notes} onChange={(e) => setTerminateForm({ ...terminateForm, notes: e.target.value })} placeholder="Reason for termination" rows={2} />
                </FormField>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTerminateDialogOpen(null)}>Cancel</Button>
                <Button variant="destructive" onClick={handleTerminateContract}>Terminate</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      )}

      {profile.role === "freelancer" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Project Rates</CardTitle>
            <Dialog open={rateDialogOpen} onOpenChange={(open) => { setRateDialogOpen(open); if (!open) setRateErrors({}); }}>
              <Button size="sm" onClick={() => setRateDialogOpen(true)}>Assign Rate</Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Project Rate</DialogTitle>
                  <DialogDescription>Set hourly rate for a project.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Project</Label>
                    <Select value={newRate.project_id} onValueChange={(v) => setNewRate({ ...newRate, project_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {rateErrors.project_id && <p className="text-xs text-destructive mt-1">{rateErrors.project_id}</p>}
                  </div>
                  <FormField label="Hourly Rate (USD)" error={rateErrors.hourly_rate} onClearError={clearFieldError(setRateErrors, "hourly_rate")}>
                    <Input type="number" value={newRate.hourly_rate} onFocus={(e) => e.target.select()} onChange={(e) => setNewRate({ ...newRate, hourly_rate: e.target.value })} />
                  </FormField>
                  <FormField label="Effective From" error={rateErrors.effective_from} onClearError={clearFieldError(setRateErrors, "effective_from")}>
                    <Input type="date" value={newRate.effective_from} onChange={(e) => setNewRate({ ...newRate, effective_from: e.target.value })} />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddRate}>Assign</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.project?.name}</TableCell>
                    <TableCell>{formatCurrency(r.hourly_rate)}/hr</TableCell>
                    <TableCell>{r.effective_from}</TableCell>
                    <TableCell>{r.effective_to || <Badge variant="success">Current</Badge>}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingRate(r);
                          setEditRateErrors({});
                          setEditRateForm({
                            hourly_rate: String(r.hourly_rate),
                            effective_from: r.effective_from,
                            effective_to: r.effective_to || "",
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteRate(r.id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Dialog open={!!editingRate} onOpenChange={(open) => { if (!open) { setEditingRate(null); setEditRateErrors({}); } }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Rate — {editingRate?.project?.name}</DialogTitle>
                  <DialogDescription>Update the hourly rate and dates.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <FormField label="Hourly Rate" error={editRateErrors.hourly_rate} onClearError={clearFieldError(setEditRateErrors, "hourly_rate")}>
                    <Input type="number" value={editRateForm.hourly_rate} onFocus={(e) => e.target.select()} onChange={(e) => setEditRateForm({ ...editRateForm, hourly_rate: e.target.value })} />
                  </FormField>
                  <FormField label="Effective From" error={editRateErrors.effective_from} onClearError={clearFieldError(setEditRateErrors, "effective_from")}>
                    <Input type="date" value={editRateForm.effective_from} onChange={(e) => setEditRateForm({ ...editRateForm, effective_from: e.target.value })} />
                  </FormField>
                  <FormField label="Effective To (leave empty for current)" error={editRateErrors.effective_to} onClearError={clearFieldError(setEditRateErrors, "effective_to")}>
                    <Input type="date" value={editRateForm.effective_to} onChange={(e) => setEditRateForm({ ...editRateForm, effective_to: e.target.value })} />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingRate(null)}>Cancel</Button>
                  <Button onClick={handleEditRate}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
