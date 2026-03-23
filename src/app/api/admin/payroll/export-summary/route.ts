import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { csvSafe } from "@/lib/sanitize";
import { generatePayrollSchema } from "@/lib/validations";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const body = await request.json();
    const parsed = generatePayrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { period_id, entity } = parsed.data;

    const { data: period } = await serviceClient
      .from("payroll_periods")
      .select("*")
      .eq("id", period_id)
      .single();
    if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

    const { data: rawRecords } = await serviceClient
      .from("payroll_records")
      .select("*, employee:profiles!inner(*)")
      .eq("period_id", period_id)
      .eq("employee.entity", entity);

    const records = (rawRecords || []).sort((a, b) => {
      const aName = (a.employee as { last_name?: string })?.last_name || "";
      const bName = (b.employee as { last_name?: string })?.last_name || "";
      return aName.localeCompare(bName);
    });

    if (records.length === 0) {
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
      csvSafe(`${r.employee?.first_name} ${r.employee?.last_name}`),
      r.gross_salary,
      r.days_worked,
      period.working_days,
      r.prorated_gross,
      r.bonus,
      csvSafe(r.bonus_note || ""),
      r.compensation_amount,
      r.total_amount,
      csvSafe(r.status),
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
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
