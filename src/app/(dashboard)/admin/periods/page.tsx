"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PayrollPeriod } from "@/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatPeriod, getApiError } from "@/lib/utils";
import { Spinner } from "@/components/spinner";
import { Plus, Lock, LockOpen } from "lucide-react";

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{ year: number | string; month: number | string; working_days: number | string }>({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, working_days: 20 });
  const { toast } = useToast();

  const loadPeriods = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("payroll_periods").select("*").order("year", { ascending: false }).order("month", { ascending: false });
    setPeriods(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  async function handleCreate() {
    const res = await fetch("/api/admin/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast({ title: "Period created" });
      setDialogOpen(false);
      loadPeriods();
    } else {
      const errMsg = await getApiError(res);
      toast({ title: "Error", description: errMsg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payroll Periods</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Period
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Period</DialogTitle>
            <DialogDescription>Add a new payroll period.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Year</Label><Input type="number" value={form.year} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, year: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Month (1-12)</Label><Input type="number" min={1} max={12} value={form.month} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, month: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Working Days</Label><Input type="number" value={form.working_days} onFocus={(e) => e.target.select()} onChange={(e) => setForm({ ...form, working_days: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Working Days</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={3}><div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-foreground" /></div></TableCell></TableRow>
          ) : periods.length === 0 ? (
            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No periods yet. Create one to get started.</TableCell></TableRow>
          ) : periods.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link href={`/admin/periods/${p.id}`} className="font-medium hover:underline">
                  {formatPeriod(p.year, p.month)}
                </Link>
              </TableCell>
              <TableCell>{p.working_days}</TableCell>
              <TableCell>
                {p.status === "open" ? (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><LockOpen className="h-4 w-4" /> Open</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Locked</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
