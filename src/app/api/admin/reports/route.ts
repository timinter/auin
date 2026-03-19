import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const periodId = url.searchParams.get("period_id");

    if (!periodId) {
      return NextResponse.json({ error: "period_id is required" }, { status: 400 });
    }

    // Fetch payroll records across all entities for this period
    const { data: payroll } = await serviceClient
      .from("payroll_records")
      .select("*, employee:profiles(*)")
      .eq("period_id", periodId);

    // Fetch freelancer invoices across all entities
    const { data: invoices } = await serviceClient
      .from("freelancer_invoices")
      .select("*, freelancer:profiles(*)")
      .eq("period_id", periodId);

    // Fetch compensations across all entities
    const { data: compensations } = await serviceClient
      .from("employee_compensations")
      .select("*, employee:profiles(*), category:compensation_categories(*)")
      .eq("period_id", periodId);

    // Fetch exchange rates for this period
    const { data: rates } = await serviceClient
      .from("exchange_rates")
      .select("*")
      .eq("period_id", periodId);

    // Aggregate by entity
    const entities = ["BY", "US", "CRYPTO"] as const;
    const summary = entities.map((entity) => {
      const entityPayroll = (payroll || []).filter((r) => r.employee?.entity === entity);
      const entityInvoices = (invoices || []).filter((inv) => inv.freelancer?.entity === entity);
      const entityComps = (compensations || []).filter((c) => c.employee?.entity === entity);

      return {
        entity,
        employees: {
          count: entityPayroll.length,
          total_gross: entityPayroll.reduce((s, r) => s + r.gross_salary, 0),
          total_prorated: entityPayroll.reduce((s, r) => s + r.prorated_gross, 0),
          total_bonuses: entityPayroll.reduce((s, r) => s + r.bonus, 0),
          total_compensation: entityPayroll.reduce((s, r) => s + r.compensation_amount, 0),
          total_amount: entityPayroll.reduce((s, r) => s + r.total_amount, 0),
          by_status: {
            draft: entityPayroll.filter((r) => r.status === "draft").length,
            pending_approval: entityPayroll.filter((r) => r.status === "pending_approval").length,
            approved: entityPayroll.filter((r) => r.status === "approved").length,
            rejected: entityPayroll.filter((r) => r.status === "rejected").length,
          },
        },
        freelancers: {
          count: entityInvoices.length,
          total_amount: entityInvoices.reduce((s, inv) => s + inv.total_amount, 0),
          by_status: {
            draft: entityInvoices.filter((inv) => inv.status === "draft").length,
            pending_approval: entityInvoices.filter((inv) => inv.status === "pending_approval").length,
            approved: entityInvoices.filter((inv) => inv.status === "approved").length,
            rejected: entityInvoices.filter((inv) => inv.status === "rejected").length,
          },
        },
        compensations: {
          count: entityComps.length,
          total_submitted: entityComps.reduce((s, c) => s + c.submitted_amount, 0),
          total_approved: entityComps.filter((c) => c.approved_amount != null).reduce((s, c) => s + (c.approved_amount || 0), 0),
          by_status: {
            pending: entityComps.filter((c) => c.status === "pending").length,
            approved: entityComps.filter((c) => c.status === "approved").length,
            rejected: entityComps.filter((c) => c.status === "rejected").length,
          },
        },
      };
    });

    // Grand totals
    const grand = {
      employee_total: summary.reduce((s, e) => s + e.employees.total_amount, 0),
      freelancer_total: summary.reduce((s, e) => s + e.freelancers.total_amount, 0),
      compensation_total: summary.reduce((s, e) => s + e.compensations.total_approved, 0),
    };

    return NextResponse.json({
      summary,
      grand,
      exchange_rates: rates || [],
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
