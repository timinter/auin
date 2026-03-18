"use client";

import { useState } from "react";
import { useProfile } from "@/lib/hooks/use-profile";
import { EntityProvider } from "@/lib/hooks/use-entity";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Unable to load profile. Please sign in again.</p>
      </div>
    );
  }

  return (
    <EntityProvider>
      <div className="flex min-h-screen">
        <Sidebar role={profile.role} />

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-64 h-full bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar role={profile.role} />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <Header
            profile={profile}
            onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
        <Toaster />
      </div>
    </EntityProvider>
  );
}
