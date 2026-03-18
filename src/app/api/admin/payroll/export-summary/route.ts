import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const { period_id, entity } = await request.json();
    if (!period_id || !entity) {
      return NextResponse.json({ error: "period_id and entity required" }, { status: 400 });
    }

    const { data: period } = await serviceClient
      .from("payroll_periods")
      .select("*")
      .eq("id", period_id)
      .single();
    if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

    const { data: records } = await serviceClient
      .from("payroll_records")
      .select("*, employee:profiles!inner(*)")
      .eq("period_id", period_id)
      .eq("employee.entity", entity)
      .order("created_at");

    if (!records || records.length === 0) {
      return NextResponse.json({ error: "No records found" }, { status: 400 });
    }

    // Build CSV
    const headers = [
      "Employee",
      "Gross Salary",
      "Days Worked",
      "Working Days",
      "Prorated Gross",
      "Bonus",
      "Bonus Note",
      "Compensation",
      "Total",
      "Status",
    ];

    const rows = records.map((r) => [
      `${r.employee?.first_name} ${r.employee?.last_name}`,
      r.gross_salary,
      r.days_worked,
      period.working_days,
      r.prorated_gross,
      r.bonus,
      `"${(r.bonus_note || "").replace(/"/g, '""')}"`,
      r.compensation_amount,
      r.total_amount,
      r.status,
    ]);

    // Totals row
    const totals = [
      `TOTALS (${records.length})`,
      "",
      "",
      "",
      records.reduce((s, r) => s + r.prorated_gross, 0),
      records.reduce((s, r) => s + r.bonus, 0),
      "",
      records.reduce((s, r) => s + r.compensation_amount, 0),
      records.reduce((s, r) => s + r.total_amount, 0),
      "",
    ];

    const csv = [headers.join(","), ...rows.map((r) => r.join(",")), totals.join(",")].join("\n");

    const filename = `payroll_${entity}_${MONTHS[period.month - 1]}_${period.year}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
