"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { ArrowLeft, Users, DollarSign, Clock } from "lucide-react";
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

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [rates, setRates] = useState<FreelancerRate[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        .select("*, freelancer:profiles(id, first_name, last_name, email)")
        .eq("project_id", params.id)
        .order("effective_from", { ascending: false });
      setRates(r || []);

      const { data: l } = await supabase
        .from("freelancer_invoice_lines")
        .select("*, invoice:freelancer_invoices(id, status, freelancer:profiles(id, first_name, last_name), period:payroll_periods(id, year, month))")
        .eq("project_id", params.id)
        .order("id", { ascending: false });
      setLines(l || []);

      setLoading(false);
    }
    loadData();
  }, [params.id]);

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
        <CardHeader>
          <CardTitle className="text-lg">Assigned Freelancers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Freelancer</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>Effective To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
