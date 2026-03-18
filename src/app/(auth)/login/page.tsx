"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DevUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department: string | null;
  payment_channel: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  employee: "bg-blue-100 text-blue-800",
  freelancer: "bg-green-100 text-green-800",
};

export default function LoginPage() {
  const router = useRouter();
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);
  const [loggingIn, setLoggingIn] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (isDev) {
      fetch("/api/auth/dev-users")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setDevUsers(data);
        })
        .catch(() => {});
    }
  }, [isDev]);

  const handleMicrosoftLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: "email profile openid",
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  };

  const handleDevLogin = async (email: string) => {
    setLoggingIn(email);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: "password123",
      });
      if (error) {
        alert(error.message);
      } else {
        router.push("/dashboard");
      }
    } catch {
      alert("Login failed");
    } finally {
      setLoggingIn(null);
    }
  };

  const filtered = devUsers.filter((u) => {
    const matchesSearch =
      !search ||
      `${u.first_name} ${u.last_name} ${u.email}`
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">SAMAP</CardTitle>
          <CardDescription>Invoice Automation Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleMicrosoftLogin} className="w-full" size="lg">
            <svg className="mr-2 h-5 w-5" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Only @interexy.com accounts are allowed
          </p>
        </CardContent>
      </Card>

      {isDev && devUsers.length > 0 && (
        <Card className="w-full border-dashed border-orange-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-orange-500">⚠</span>
              Dev Login
              <span className="text-xs font-normal text-muted-foreground">
                (development only)
              </span>
            </CardTitle>
            <CardDescription>
              Click any user to sign in as them — no password required
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded-md border px-3 py-1.5 text-sm"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border px-2 py-1.5 text-sm"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
                <option value="freelancer">Freelancer</option>
              </select>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1">
              {filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleDevLogin(user.email)}
                  disabled={loggingIn !== null}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">
                      {user.first_name} {user.last_name}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs truncate">
                      {user.email}
                    </span>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ROLE_COLORS[user.role] || ""
                    }`}
                  >
                    {user.role}
                  </span>
                  {user.payment_channel && (
                    <span className="text-xs text-muted-foreground">
                      {user.payment_channel}
                    </span>
                  )}
                  {loggingIn === user.email && (
                    <span className="text-xs text-orange-500 animate-pulse">
                      Signing in...
                    </span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No users match your search
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {filtered.length} of {devUsers.length} users shown
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
