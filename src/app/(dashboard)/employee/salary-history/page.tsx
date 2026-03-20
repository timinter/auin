"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { EmployeeContract } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function SalaryHistoryPage() {
  const { profile } = useProfile();
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("employee_contracts")
        .select("*")
        .eq("employee_id", profile!.id)
        .order("effective_from", { ascending: false });
      setContracts(data || []);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) return <PageSpinner />;

  const activeContract = contracts.find(
    (c) => !c.effective_to && !c.terminated_at
  );

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getStatus = (c: EmployeeContract) => {
    if (c.terminated_at) return "terminated";
    if (c.effective_to) return "ended";
    return "active";
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "active": return "success" as const;
      case "terminated": return "destructive" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Salary History</h1>

      {activeContract && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {formatCurrency(activeContract.gross_salary)}
              </span>
              <span className="text-muted-foreground">/ month (gross)</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Effective since {formatDate(activeContract.effective_from)}
              {activeContract.notes && ` — ${activeContract.notes}`}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>Effective To</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No contract history
                  </TableCell>
                </TableRow>
              ) : contracts.map((c, i) => {
                const prevContract = contracts[i + 1]; // older contract (sorted desc)
                const diff = prevContract
                  ? c.gross_salary - prevContract.gross_salary
                  : 0;
                const status = getStatus(c);

                return (
                  <TableRow key={c.id}>
                    <TableCell className="capitalize">{c.contract_type.replace("_", " ")}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(c.gross_salary)}</TableCell>
                    <TableCell>
                      {prevContract ? (
                        <span className={`inline-flex items-center gap-1 text-sm ${diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Initial</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(c.effective_from)}</TableCell>
                    <TableCell>{c.effective_to ? formatDate(c.effective_to) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(status)}>{status}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
