"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AuditLogEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/spinner";

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 50;

  const loadEntries = useCallback(async (loadMore = false) => {
    const supabase = createClient();
    const from = loadMore ? offset : 0;
    const { data } = await supabase
      .from("audit_log")
      .select("*, user:profiles(first_name, last_name, email)")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (loadMore) {
      setEntries((prev) => [...prev, ...(data || [])]);
    } else {
      setEntries(data || []);
    }
    setOffset(from + PAGE_SIZE);
    setLoading(false);
  }, [offset]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date/Time</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Entity ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={5}><div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-foreground" /></div></TableCell></TableRow>
          ) : entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-xs whitespace-nowrap">
                {new Date(entry.created_at).toLocaleString()}
              </TableCell>
              <TableCell>
                {entry.user ? `${entry.user.first_name} ${entry.user.last_name}` : "System"}
              </TableCell>
              <TableCell><Badge variant="outline">{entry.action}</Badge></TableCell>
              <TableCell>{entry.entity_type}</TableCell>
              <TableCell className="font-mono text-xs">{entry.entity_id.slice(0, 8)}...</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => loadEntries(true)}>Load More</Button>
      </div>
    </div>
  );
}
