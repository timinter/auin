"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { FreelancerInvoice } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { Spinner } from "@/components/spinner";

export default function FreelancerInvoicesPage() {
  const { profile } = useProfile();
  const [invoices, setInvoices] = useState<FreelancerInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("freelancer_invoices")
        .select("*, period:payroll_periods(*)")
        .eq("freelancer_id", profile!.id)
        .order("created_at", { ascending: false });
      setInvoices(data || []);
      setLoading(false);
    }
    load();
  }, [profile]);

  const statusVariant = (s: string) => {
    switch (s) {
      case "approved": return "success" as const;
      case "pending_approval": return "warning" as const;
      case "rejected": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Invoices</h1>
        <Link href="/freelancer/invoices/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Submit Hours
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={3}><div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-foreground" /></div></TableCell></TableRow>
          ) : invoices.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No invoices yet</TableCell></TableRow>
          ) : invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>
                <Link href={`/freelancer/invoices/${inv.id}`} className="font-medium hover:underline">
                  {inv.period && formatPeriod(inv.period.year, inv.period.month)}
                </Link>
              </TableCell>
              <TableCell className="font-semibold">{formatCurrency(inv.total_amount)}</TableCell>
              <TableCell><Badge variant={statusVariant(inv.status)}>{inv.status.replace("_", " ")}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
