"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { getApiError } from "@/lib/utils";
import { PageSpinner } from "@/components/spinner";
import { RefreshCw, Users, Heart, CalendarOff } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MedicalBalance {
  employee_id: string;
  email: string;
  name: string;
  annual_limit: number;
  used: number;
  remaining: number;
}

interface SyncResult {
  synced?: number;
  skipped: number;
  errors?: string[];
  imported?: number;
}

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
}

export default function PeopleForcePage() {
  const [medicalBalances, setMedicalBalances] = useState<MedicalBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [loadingMedical, setLoadingMedical] = useState(false);

  // Leave sync state
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [syncingLeaves, setSyncingLeaves] = useState(false);
  const [leaveSyncResult, setLeaveSyncResult] = useState<SyncResult | null>(null);

  const { toast } = useToast();

  const loadMedicalBalances = useCallback(async () => {
    setLoadingMedical(true);
    try {
      const res = await fetch("/api/admin/peopleforce/medical-balances");
      if (res.ok) {
        setMedicalBalances(await res.json());
      } else {
        const errMsg = await getApiError(res);
        if (res.status !== 503) {
          toast({ title: "Error", description: errMsg, variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Error", description: "Failed to load medical balances", variant: "destructive" });
    }
    setLoadingMedical(false);
  }, [toast]);

  const loadPeriods = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/periods");
      if (res.ok) {
        const data: Period[] = await res.json();
        setPeriods(data);
        // Auto-select the most recent open period
        const openPeriod = data.find((p) => p.status === "open");
        if (openPeriod) setSelectedPeriodId(openPeriod.id);
        else if (data.length > 0) setSelectedPeriodId(data[0].id);
      }
    } catch {
      // periods not critical for initial load
    }
  }, []);

  useEffect(() => {
    Promise.all([loadMedicalBalances(), loadPeriods()]).then(() => setLoading(false));
  }, [loadMedicalBalances, loadPeriods]);

  async function handleSyncEmployees() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/peopleforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_employees" }),
      });
      if (res.ok) {
        const result: SyncResult = await res.json();
        setSyncResult(result);
        toast({
          title: "Sync Complete",
          description: `${result.synced} updated, ${result.skipped} unchanged`,
        });
        loadMedicalBalances();
      } else {
        toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Sync failed", variant: "destructive" });
    }
    setSyncing(false);
  }

  async function handleSyncLeaves() {
    if (!selectedPeriodId) return;
    const period = periods.find((p) => p.id === selectedPeriodId);
    if (!period) return;

    setSyncingLeaves(true);
    setLeaveSyncResult(null);
    try {
      const res = await fetch("/api/admin/peopleforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_leaves",
          period_id: period.id,
          year: period.year,
          month: period.month,
        }),
      });
      if (res.ok) {
        const result: SyncResult = await res.json();
        setLeaveSyncResult(result);
        toast({
          title: "Leave Sync Complete",
          description: `${result.imported} imported, ${result.skipped} skipped`,
        });
      } else {
        toast({ title: "Error", description: await getApiError(res), variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Leave sync failed", variant: "destructive" });
    }
    setSyncingLeaves(false);
  }

  if (loading) return <PageSpinner />;

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">PeopleForce Integration</h1>
      </div>

      {/* Employee Sync */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Sync
            </CardTitle>
            <Button onClick={handleSyncEmployees} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Syncs employee data from PeopleForce: department, status, entity, hire date, and PeopleForce ID.
            Matches by email. Does not create new users.
          </p>
          {syncResult && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p><strong>{syncResult.synced}</strong> profiles updated</p>
              <p><strong>{syncResult.skipped}</strong> unchanged / not found in SAMAP</p>
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="text-destructive mt-2">
                  {syncResult.errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Sync */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Leave Sync
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {MONTHS[p.month - 1]} {p.year}
                      {p.status === "open" ? " (Open)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleSyncLeaves}
                disabled={syncingLeaves || !selectedPeriodId}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncingLeaves ? "animate-spin" : ""}`} />
                {syncingLeaves ? "Syncing..." : "Sync Leaves"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Imports approved leaves (vacation, sick, day off, unpaid) from PeopleForce for the selected period.
            Duplicates are automatically skipped via external ID tracking.
          </p>
          {selectedPeriod && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm">Selected:</span>
              <Badge variant="outline">
                {MONTHS[selectedPeriod.month - 1]} {selectedPeriod.year}
              </Badge>
              <Badge variant={selectedPeriod.status === "open" ? "default" : "secondary"}>
                {selectedPeriod.status}
              </Badge>
            </div>
          )}
          {leaveSyncResult && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p><strong>{leaveSyncResult.imported}</strong> leaves imported</p>
              <p><strong>{leaveSyncResult.skipped}</strong> skipped (duplicates / unmatched / unsupported types)</p>
              {leaveSyncResult.errors && leaveSyncResult.errors.length > 0 && (
                <div className="text-destructive mt-2">
                  {leaveSyncResult.errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Insurance Balances */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Medical Insurance Balances
            </CardTitle>
            <Button
              onClick={loadMedicalBalances}
              disabled={loadingMedical}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingMedical ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {medicalBalances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No medical insurance data available. Make sure employees are synced with PeopleForce first.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Annual Limit</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicalBalances.map((b) => (
                  <TableRow key={b.employee_id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.email}</TableCell>
                    <TableCell className="text-right">${b.annual_limit}</TableCell>
                    <TableCell className="text-right">${b.used}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={b.remaining < 50 ? "text-destructive" : ""}>
                        ${b.remaining}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
