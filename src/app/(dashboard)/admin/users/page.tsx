"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEntity, ENTITY_LABELS } from "@/lib/hooks/use-entity";
import type { Profile } from "@/types";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { getApiError } from "@/lib/utils";
import { Spinner } from "@/components/spinner";
import { UserPlus, Search } from "lucide-react";

const PAGE_SIZE = 50;

export default function UsersPage() {
  const { entity } = useEntity();
  const [profiles, setProfiles] = useState<(Profile & { gross_salary?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("employee");
  const [inviting, setInviting] = useState(false);
  const [roleTab, setRoleTab] = useState<"employee" | "freelancer">("employee");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { toast } = useToast();
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search input — 300ms
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const buildQuery = useCallback(
    (supabase: ReturnType<typeof createClient>, searchTerm: string) => {
      let query = supabase
        .from("profiles")
        .select("*, employee_contracts!employee_contracts_employee_id_fkey(gross_salary)", { count: "exact" })
        .eq("entity", entity)
        .in("role", roleTab === "employee" ? ["employee", "admin"] : ["freelancer"])
        .order("last_name");

      if (searchTerm) {
        // Search across name, email, role, department using OR of ilike patterns
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,role.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%`
        );
      }

      return query;
    },
    [entity, roleTab]
  );

  const loadProfiles = useCallback(async (searchTerm: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data, count } = await buildQuery(supabase, searchTerm).range(0, PAGE_SIZE - 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (data || []).map((p: any) => {
      const contracts = (p.employee_contracts || []) as { gross_salary: number }[];
      const latest = contracts.length > 0 ? contracts[contracts.length - 1] : null;
      return { ...p, gross_salary: latest?.gross_salary, employee_contracts: undefined };
    });
    const total = count || 0;
    setProfiles(results);
    setTotalCount(total);
    setHasMore(results.length < total);
    setLoading(false);
  }, [buildQuery]);

  // Reload when entity, role tab, or debounced search changes
  useEffect(() => {
    loadProfiles(debouncedSearch);
  }, [entity, roleTab, debouncedSearch, loadProfiles]);

  async function loadMore() {
    setLoadingMore(true);
    const supabase = createClient();
    const from = profiles.length;
    const { data } = await buildQuery(supabase, debouncedSearch).range(from, from + PAGE_SIZE - 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newResults = (data || []).map((p: any) => {
      const contracts = (p.employee_contracts || []) as { gross_salary: number }[];
      const latest = contracts.length > 0 ? contracts[contracts.length - 1] : null;
      return { ...p, gross_salary: latest?.gross_salary, employee_contracts: undefined };
    });
    const combined = [...profiles, ...newResults];
    setProfiles(combined);
    setHasMore(combined.length < totalCount);
    setLoadingMore(false);
  }

  async function handleInvite() {
    setInviting(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, entity }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: "Invitation sent", description: `Link: ${data.inviteLink}` });
        setInviteOpen(false);
        setInviteEmail("");
      } else {
        const errMsg = await getApiError(res);
        toast({ title: "Error", description: errMsg, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send invitation", variant: "destructive" });
    }
    setInviting(false);
  }

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "default" as const;
      case "employee": return "secondary" as const;
      case "freelancer": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
              <DialogDescription>Send an invitation to join the {ENTITY_LABELS[entity]} space.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@interexy.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="freelancer">Freelancer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                {inviting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={roleTab} onValueChange={(v) => setRoleTab(v as "employee" | "freelancer")}>
        <TabsList>
          <TabsTrigger value="employee">Employees</TabsTrigger>
          <TabsTrigger value="freelancer">Freelancers</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {!loading && (
        <p className="text-sm text-muted-foreground">
          Showing {profiles.length} of {totalCount} user{totalCount !== 1 ? "s" : ""}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Gross Salary</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6}><div className="flex justify-center py-4"><Spinner className="h-6 w-6 text-foreground" /></div></TableCell>
            </TableRow>
          ) : profiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {debouncedSearch ? `No ${roleTab}s matching "${debouncedSearch}".` : `No ${roleTab}s in this entity space. Invite someone to get started.`}
              </TableCell>
            </TableRow>
          ) : (
            profiles.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/admin/users/${p.id}`} className="font-medium hover:underline">
                    {p.first_name} {p.last_name}
                  </Link>
                </TableCell>
                <TableCell>{p.gross_salary ? formatCurrency(p.gross_salary) : "—"}</TableCell>
                <TableCell>
                  <Badge variant={roleBadgeVariant(p.role)}>{p.role}</Badge>
                </TableCell>
                <TableCell>{p.department || "—"}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "active" ? "success" : "destructive"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell>{p.payment_channel || "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Loading...
              </>
            ) : (
              `Load more (${totalCount - profiles.length} remaining)`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
