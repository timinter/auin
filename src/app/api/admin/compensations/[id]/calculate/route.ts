import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { calculateCompensation } from "@/lib/compensation/calculate";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/compensations/[id]/calculate
 * Returns a breakdown of the auto-calculated compensation amount.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Fetch compensation with category and employee tax_rate
    const { data: comp, error } = await serviceClient
      .from("employee_compensations")
      .select("*, compensation_categories(*), profiles!employee_compensations_employee_id_fkey(tax_rate)")
      .eq("id", params.id)
      .single();

    if (error || !comp) {
      return NextResponse.json({ error: "Compensation not found" }, { status: 404 });
    }

    const category = comp.compensation_categories as unknown as {
      name: string;
      limit_percentage: number | null;
      max_gross: number | null;
      annual_max_gross: number | null;
      is_prorated: boolean;
    };
    const employee = comp.profiles as unknown as { tax_rate: number } | null;
    const taxRate = employee?.tax_rate ?? 0.13;

    // Get exchange rate for the period
    let exchangeRate: number | null = null;
    if (comp.submitted_currency !== "USD") {
      const { data: rate } = await serviceClient
        .from("exchange_rates")
        .select("rate")
        .eq("period_id", comp.period_id)
        .eq("from_currency", "BYN")
        .eq("to_currency", "USD")
        .single();
      exchangeRate = rate?.rate ?? null;
    }

    // Get year-to-date approved for annual cap check
    let yearToDateApproved = 0;
    if (category.annual_max_gross != null) {
      // Find all periods in the same year
      const { data: period } = await serviceClient
        .from("payroll_periods")
        .select("year")
        .eq("id", comp.period_id)
        .single();

      if (period) {
        const { data: yearPeriods } = await serviceClient
          .from("payroll_periods")
          .select("id")
          .eq("year", period.year);

        const periodIds = (yearPeriods || []).map((p) => p.id);

        if (periodIds.length > 0) {
          const { data: yearComps } = await serviceClient
            .from("employee_compensations")
            .select("approved_amount")
            .eq("employee_id", comp.employee_id)
            .eq("category_id", comp.category_id)
            .eq("status", "approved")
            .in("period_id", periodIds)
            .neq("id", comp.id); // exclude current one

          yearToDateApproved = (yearComps || []).reduce(
            (sum, c) => sum + (c.approved_amount || 0), 0
          );
        }
      }
    }

    if (comp.submitted_currency !== "USD" && !exchangeRate) {
      return NextResponse.json({
        error: "No exchange rate set for this period. Please set the NBRB rate first.",
        breakdown: null,
      }, { status: 422 });
    }

    const breakdown = calculateCompensation({
      submittedAmount: comp.submitted_amount,
      submittedCurrency: comp.submitted_currency,
      exchangeRate,
      category,
      taxRate,
      yearToDateApproved,
    });

    return NextResponse.json({
      breakdown,
      exchangeRate,
      taxRate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
