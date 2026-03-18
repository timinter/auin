"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { PayrollRecord } from "@/types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPeriod } from "@/lib/utils";
import { Spinner } from "@/components/spinner";

const statusVariant = (s: string) => {
  switch (s) {
    case "approved": return "success" as const;
    case "pending_approval": return "warning" as const;
    case "rejected": return "destructive" as const;
    default: return "secondary" as const;
  }
};

export default function EmployeePayrollPage() {
  const { profile } = useProfile();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("payroll_records")
        .select("*, period:payroll_periods(*)")
        .eq("employee_id", profile!.id)
        .order("created_at", { ascending: false });
      setRecords(data || []);
      setLoading(false);
    }
    load();
  }, [profile]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Payroll</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Gross</TableHead>
            <TableHead>Prorated</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={5}><div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-foreground" /></div></TableCell></TableRow>
          ) : records.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No payroll records yet</TableCell></TableRow>
          ) : records.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link href={`/employee/payroll/${r.id}`} className="font-medium hover:underline">
                  {r.period && formatPeriod(r.period.year, r.period.month)}
                </Link>
              </TableCell>
              <TableCell>{formatCurrency(r.gross_salary)}</TableCell>
              <TableCell>{formatCurrency(r.prorated_gross)}</TableCell>
              <TableCell className="font-semibold">{formatCurrency(r.total_amount)}</TableCell>
              <TableCell><Badge variant={statusVariant(r.status)}>{r.status.replace("_", " ")}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
