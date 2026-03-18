import { requireRole } from "@/lib/auth";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const submitCompensationSchema = z.object({
  period_id: z.string().uuid(),
  category_id: z.string().uuid(),
  submitted_amount: z.number().positive().max(99_999),
  receipt_url: z.string().url().max(1000).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const url = new URL(request.url);
    const periodId = url.searchParams.get("period_id");

    let query = serviceClient
      .from("employee_compensations")
      .select("*, category:compensation_categories(*), period:payroll_periods(*)")
      .eq("employee_id", user.id)
      .order("created_at", { ascending: false });

    if (periodId) query = query.eq("period_id", periodId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = submitCompensationSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Verify period is open
    const { data: period } = await serviceClient
      .from("payroll_periods")
      .select("status")
      .eq("id", parsed.data.period_id)
      .single();
    if (!period || period.status !== "open") {
      return NextResponse.json({ error: "Period is not open for submissions" }, { status: 400 });
    }

    // Verify category exists and is active
    const { data: category } = await serviceClient
      .from("compensation_categories")
      .select("*")
      .eq("id", parsed.data.category_id)
      .single();
    if (!category || !category.is_active) {
      return NextResponse.json({ error: "Invalid compensation category" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("employee_compensations")
      .insert({
        employee_id: user.id,
        period_id: parsed.data.period_id,
        category_id: parsed.data.category_id,
        submitted_amount: parsed.data.submitted_amount,
        receipt_url: parsed.data.receipt_url || null,
      })
      .select("*, category:compensation_categories(*)")
      .single();

    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
