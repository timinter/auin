"use client";

import { useCallback, useEffect, useState } from "react";
import type { CorporateHoliday } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { Plus, Trash2 } from "lucide-react";

const currentYear = new Date().getFullYear();
const years = [currentYear - 1, currentYear, currentYear + 1];

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<CorporateHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/holidays?year=${selectedYear}`);
    if (res.ok) {
      setHolidays(await res.json());
    } else {
      toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
    }
    setLoading(false);
  }, [selectedYear, toast]);

  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  async function handleAdd() {
    if (!newDate || !newName) return;
    setAdding(true);
    const res = await fetch("/api/admin/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, name: newName }),
    });
    if (res.ok) {
      toast({ title: "Holiday added" });
      setNewDate("");
      setNewName("");
      loadHolidays();
    } else {
      toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/holidays/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Holiday removed" });
      loadHolidays();
    } else {
      toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Corporate Holidays</h1>

      <div className="flex gap-3 items-end">
        <div>
          <Label>Year</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Holiday
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div>
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Independence Day" />
            </div>
            <Button onClick={handleAdd} disabled={adding || !newDate || !newName}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No corporate holidays for {selectedYear}
                    </TableCell>
                  </TableRow>
                ) : holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">{formatDate(h.date)}</TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(h.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
