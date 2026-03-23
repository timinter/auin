"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEntity, ENTITIES, ENTITY_LABELS } from "@/lib/hooks/use-entity";
import type { UserRole } from "@/types";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  FolderOpen,
  ScrollText,
  Receipt,
  UserCircle,
  Clock,
  Heart,
  BarChart3,
  CalendarOff,
  ClipboardList,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Periods", href: "/admin/periods", icon: Calendar },
  { title: "Projects", href: "/admin/projects", icon: FolderOpen },
  { title: "Freelancer Invoices", href: "/admin/freelancer-invoices", icon: Receipt },
  { title: "Receipts", href: "/admin/receipts", icon: Heart },
  { title: "Comp. Report", href: "/admin/compensation-report", icon: ClipboardList },
  { title: "Leaves", href: "/admin/leaves", icon: CalendarOff },
  { title: "Holidays", href: "/admin/holidays", icon: Clock },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
  { title: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
];

const employeeNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "My Payroll", href: "/employee/payroll", icon: FileText },
  { title: "Salary History", href: "/employee/salary-history", icon: Clock },
  { title: "Compensations", href: "/employee/compensations", icon: Heart },
  { title: "Leaves", href: "/employee/leaves", icon: CalendarOff },
  { title: "Profile", href: "/employee/profile", icon: UserCircle },
];

const freelancerNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "My Invoices", href: "/freelancer/invoices", icon: Receipt },
  { title: "New Invoice", href: "/freelancer/invoices/new", icon: Clock },
  { title: "Profile", href: "/freelancer/profile", icon: UserCircle },
];

function getNavItems(role: UserRole): NavItem[] {
  switch (role) {
    case "admin":
      return adminNav;
    case "employee":
      return employeeNav;
    case "freelancer":
      return freelancerNav;
    default:
      return [];
  }
}

interface SidebarProps {
  role: UserRole;
  mobile?: boolean;
  onNavigate?: () => void;
}

function ByFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 16" fill="none">
      <rect x="0.5" y="0.5" width="23" height="15" rx="0.5" fill="#fff" stroke="#d4d4d8" strokeWidth="1" />
      <rect x="0.5" y="5.33" width="23" height="5.34" fill="#CE2028" />
    </svg>
  );
}

function UsFlag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 16" fill="none">
      <rect width="24" height="16" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect key={i} y={i * (16 / 13)} width="24" height={16 / 13} fill="#fff" />
      ))}
      <rect width="9.6" height="8.6" fill="#3C3B6E" />
    </svg>
  );
}


function CryptoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 16" fill="none">
      <rect width="24" height="16" rx="2" fill="#1e1e2e" />
      <text x="12" y="11.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#f7931a">&#8383;</text>
    </svg>
  );
}

const ENTITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BY: ByFlag,
  US: UsFlag,
  CRYPTO: CryptoIcon,
};

export function Sidebar({ role, mobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const items = getNavItems(role);
  const { entity, setEntity } = useEntity();

  return (
    <aside className={mobile ? "flex flex-col w-64 min-h-full bg-muted/40" : "hidden md:flex md:flex-col md:w-64 md:min-h-screen border-r bg-muted/40"}>
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold">SAMAP</span>
        </Link>
        <p className="text-xs text-muted-foreground mt-1 capitalize">{role} Portal</p>
      </div>

      {role === "admin" && (
        <div className="px-3 mb-4">
          <div className="flex flex-col gap-1 rounded-lg bg-muted p-1">
            {ENTITIES.map((e) => {
              const Icon = ENTITY_ICONS[e];
              return (
                <button
                  key={e}
                  onClick={() => setEntity(e)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    entity === e
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="w-4 flex-shrink-0 flex items-center justify-center">{Icon && <Icon className="h-3 w-4 rounded-[1px]" />}</span>
                  {ENTITY_LABELS[e]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 space-y-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(item.href + "/") &&
              !items.some((other) => other.href !== item.href && pathname.startsWith(other.href) && other.href.length > item.href.length));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
