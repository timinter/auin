import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Entity } from "@/types";

interface PayrollWithEmployee {
  period_id: string;
  total_amount: number;
  employee: { entity: Entity }[];
}

interface InvoiceWithFreelancer {
  period_id: string;
  total_amount: number;
  freelancer: { entity: Entity }[];
}

/**
 * GET /api/admin/dashboard-trends?entity=US
 *
 * Returns the last 6 payroll periods with aggregated totals
 * for employees and freelancers, used for the spending trend chart.
 * When entity is provided, filters to only that entity's records.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity");

    const validEntities = ["BY", "US", "CRYPTO"];
    if (entity && !validEntities.includes(entity)) {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }

    // Fetch last 6 periods ordered by date desc
    const { data: periods } = await serviceClient
      .from("payroll_periods")
      .select("id, year, month")
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(6);

    if (!periods || periods.length === 0) {
      return NextResponse.json([]);
    }

    const periodIds = periods.map((p) => p.id);

    // Fetch all payroll records and freelancer invoices for these periods
    // Include entity join so we can filter client-side
    const [payrollResult, invoiceResult] = await Promise.all([
      serviceClient
        .from("payroll_records")
        .select("period_id, total_amount, employee:profiles(entity)")
        .in("period_id", periodIds),
      serviceClient
        .from("freelancer_invoices")
        .select("period_id, total_amount, freelancer:profiles(entity)")
        .in("period_id", periodIds),
    ]);

    let payrollRecords = (payrollResult.data || []) as PayrollWithEmployee[];
    let invoices = (invoiceResult.data || []) as InvoiceWithFreelancer[];

    // Filter by entity if provided
    if (entity) {
      payrollRecords = payrollRecords.filter((r) => r.employee?.[0]?.entity === entity);
      invoices = invoices.filter((r) => r.freelancer?.[0]?.entity === entity);
    }

    // Aggregate by period
    const trends = periods.map((p) => {
      const employeeTotal = payrollRecords
        .filter((r) => r.period_id === p.id)
        .reduce((sum, r) => sum + (r.total_amount || 0), 0);
      const freelancerTotal = invoices
        .filter((inv) => inv.period_id === p.id)
        .reduce((sum, inv) => sum + (inv.total_amount || 0), 0);

      return {
        year: p.year,
        month: p.month,
        employeeTotal,
        freelancerTotal,
        total: employeeTotal + freelancerTotal,
      };
    });

    // Return in chronological order (oldest first)
    return NextResponse.json(trends.reverse());
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
