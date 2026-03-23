import { requireRole } from "@/lib/auth";
import { createLeaveSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const url = new URL(request.url);
    const periodId = url.searchParams.get("period_id");

    let query = serviceClient
      .from("leave_requests")
      .select("*, period:payroll_periods(*)")
      .eq("employee_id", user.id)
      .order("start_date", { ascending: false });

    if (periodId) query = query.eq("period_id", periodId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = createLeaveSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Verify period exists and is open
    const { data: period } = await serviceClient
      .from("payroll_periods")
      .select("status")
      .eq("id", parsed.data.period_id)
      .single();
    if (!period || period.status !== "open") {
      return NextResponse.json({ error: "Period is not open for submissions" }, { status: 400 });
    }

    // Check for overlapping approved/pending leaves
    const { data: overlapping } = await serviceClient
      .from("leave_requests")
      .select("id")
      .eq("employee_id", user.id)
      .in("status", ["pending", "approved"])
      .lte("start_date", parsed.data.end_date)
      .gte("end_date", parsed.data.start_date);

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({ error: "Overlapping leave request already exists" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("leave_requests")
      .insert({
        employee_id: user.id,
        period_id: parsed.data.period_id,
        leave_type: parsed.data.leave_type,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        days_count: parsed.data.days_count,
        reason: parsed.data.reason || null,
      })
      .select("*, period:payroll_periods(*)")
      .single();

    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
