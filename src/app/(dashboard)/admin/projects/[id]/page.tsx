"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { ArrowLeft, Users, DollarSign, Clock, Plus, Trash2 } from "lucide-react";
import { PageSpinner } from "@/components/spinner";

interface FreelancerRate {
  id: string;
  freelancer_id: string;
  hourly_rate: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  freelancer: { id: string; first_name: string; last_name: string; email: string } | null;
}

interface InvoiceLine {
  id: string;
  hours: number;
  hourly_rate: number;
  line_total: number;
  invoice: {
    id: string;
    period: { id: string; year: number; month: number } | null;
    freelancer: { id: string; first_name: string; last_name: string } | null;
    status: string;
  } | null;
}

interface AvailableFreelancer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [rates, setRates] = useState<FreelancerRate[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [freelancers, setFreelancers] = useState<AvailableFreelancer[]>([]);
  const [assignForm, setAssignForm] = useState({ freelancer_id: "", hourly_rate: "", effective_from: "" });
  const [assignErrors, setAssignErrors] = useState<Record<string, string>>({});

  async function loadData() {
    setLoading(true);
    const supabase = createClient();

    const { data: p } = await supabase
      .from("projects")
      .select("*")
      .eq("id", params.id)
      .single();
    setProject(p);

    const { data: r } = await supabase
      .from("freelancer_project_rates")
      .select("*, freelancer:profiles!freelancer_project_rates_freelancer_id_fkey(id, first_name, last_name, email)")
      .eq("project_id", params.id);
    setRates((r || []).sort((a, b) => (a.freelancer?.last_name || "").localeCompare(b.freelancer?.last_name || "")));

    const { data: l } = await supabase
      .from("freelancer_invoice_lines")
      .select("*, invoice:freelancer_invoices(id, status, freelancer:profiles(id, first_name, last_name), period:payroll_periods(id, year, month))")
      .eq("project_id", params.id)
      .order("id", { ascending: false });
    setLines(l || []);

    setLoading(false);
  }

  useEffect(() => { loadData(); }, [params.id]);

  async function loadFreelancers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "freelancer")
      .eq("status", "active")
      .order("last_name");
    setFreelancers(data || []);
  }

  async function handleAssign() {
    setAssignErrors({});
    const res = await fetch("/api/admin/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        freelancer_id: assignForm.freelancer_id,
        project_id: params.id,
        hourly_rate: parseFloat(assignForm.hourly_rate),
        effective_from: assignForm.effective_from,
      }),
    });
    if (res.ok) {
      toast({ title: "Freelancer assigned" });
      setAssignOpen(false);
      setAssignForm({ freelancer_id: "", hourly_rate: "", effective_from: "" });
      loadData();
    } else {
      const data = await res.json();
      if (data.fieldErrors) setAssignErrors(data.fieldErrors);
      else toast({ title: "Error", description: data.error, variant: "destructive" });
    }
  }

  async function handleRemoveRate(rateId: string) {
    if (!confirm("Remove this freelancer assignment?")) return;
    const res = await fetch(`/api/admin/rates/${rateId}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Assignment removed" });
      loadData();
    } else {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" });
    }
  }

  if (loading || !project) return <PageSpinner />;

  const totalSpend = lines.reduce((s, l) => s + l.line_total, 0);
  const totalHours = lines.reduce((s, l) => s + l.hours, 0);
  const uniqueFreelancers = new Set(rates.map((r) => r.freelancer_id));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/projects" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" /> Back to Projects
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Badge variant={project.status === "active" ? "success" : "secondary"}>{project.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Freelancers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueFreelancers.size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSpend)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Assigned Freelancers</CardTitle>
          <Button size="sm" onClick={() => { setAssignOpen(true); loadFreelancers(); }}>
            <Plus className="h-4 w-4 mr-1" /> Assign Freelancer
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Freelancer</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>Effective To</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No freelancers assigned to this project yet.
                  </TableCell>
                </TableRow>
              ) : rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/admin/users/${r.freelancer_id}`} className="font-medium hover:underline">
                      {r.freelancer?.first_name} {r.freelancer?.last_name}
                    </Link>
                  </TableCell>
                  <TableCell>{formatCurrency(r.hourly_rate)}/hr</TableCell>
                  <TableCell>{r.effective_from}</TableCell>
                  <TableCell>{r.effective_to || "Ongoing"}</TableCell>
                  <TableCell>
                    <button onClick={() => handleRemoveRate(r.id)} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Freelancer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Freelancer</Label>
              <Select value={assignForm.freelancer_id} onValueChange={(v) => setAssignForm({ ...assignForm, freelancer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select freelancer" /></SelectTrigger>
                <SelectContent>
                  {freelancers.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.first_name} {f.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assignErrors.freelancer_id && <p className="text-xs text-destructive mt-1">{assignErrors.freelancer_id}</p>}
            </div>
            <div>
              <Label>Hourly Rate ($)</Label>
              <Input type="number" step="0.01" value={assignForm.hourly_rate} onChange={(e) => setAssignForm({ ...assignForm, hourly_rate: e.target.value })} />
              {assignErrors.hourly_rate && <p className="text-xs text-destructive mt-1">{assignErrors.hourly_rate}</p>}
            </div>
            <div>
              <Label>Effective From</Label>
              <Input type="date" value={assignForm.effective_from} onChange={(e) => setAssignForm({ ...assignForm, effective_from: e.target.value })} />
              {assignErrors.effective_from && <p className="text-xs text-destructive mt-1">{assignErrors.effective_from}</p>}
            </div>
            <Button onClick={handleAssign} className="w-full">Assign</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Freelancer</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No invoices for this project yet.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.invoice?.period ? (
                          <Link href={`/admin/periods/${l.invoice.period.id}?tab=freelancers`} className="hover:underline">
                            {formatPeriod(l.invoice.period.year, l.invoice.period.month)}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {l.invoice?.freelancer ? (
                          <Link href={`/admin/users/${l.invoice.freelancer.id}`} className="font-medium hover:underline">
                            {l.invoice.freelancer.first_name} {l.invoice.freelancer.last_name}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{l.hours}</TableCell>
                      <TableCell>{formatCurrency(l.hourly_rate)}/hr</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(l.line_total)}</TableCell>
                      <TableCell>
                        {l.invoice?.status && (
                          <Badge variant={
                            l.invoice.status === "approved" ? "success" :
                            l.invoice.status === "pending_approval" ? "warning" :
                            l.invoice.status === "rejected" ? "destructive" : "secondary"
                          }>
                            {l.invoice.status.replace("_", " ")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Totals</TableCell>
                    <TableCell />
                    <TableCell>{totalHours.toFixed(1)}</TableCell>
                    <TableCell />
                    <TableCell>{formatCurrency(totalSpend)}</TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
