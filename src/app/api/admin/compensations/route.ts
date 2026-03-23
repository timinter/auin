import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { uuidParam } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const addCompensationSchema = z.object({
  employee_id: z.string().uuid(),
  period_id: z.string().uuid(),
  category_id: z.string().uuid(),
  submitted_amount: z.number().positive().max(99_999),
  submitted_currency: z.string().default("USD"),
  approved_amount: z.number().min(0).max(99_999).optional(),
});

const VALID_ENTITIES = ["BY", "US", "CRYPTO"] as const;

export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const periodId = url.searchParams.get("period_id");
    const entity = url.searchParams.get("entity");
    const status = url.searchParams.get("status");

    // Validate query params
    if (periodId && !uuidParam.safeParse(periodId).success) {
      return NextResponse.json({ error: "Invalid period_id" }, { status: 400 });
    }
    if (entity && !z.enum(VALID_ENTITIES).safeParse(entity).success) {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }
    if (status && !z.enum(["pending", "approved", "rejected"]).safeParse(status).success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    let query = serviceClient
      .from("employee_compensations")
      .select("*, category:compensation_categories(*), employee:profiles!inner(*), period:payroll_periods(*)");

    if (periodId) query = query.eq("period_id", periodId);
    if (entity) query = query.eq("employee.entity", entity);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to load compensations" }, { status: 400 });

    // Sort by employee last name
    const sorted = (data || []).sort((a, b) => {
      const aName = (a.employee as { last_name?: string })?.last_name || "";
      const bName = (b.employee as { last_name?: string })?.last_name || "";
      return aName.localeCompare(bName);
    });
    return NextResponse.json(sorted);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = addCompensationSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const { employee_id, period_id, category_id, submitted_amount, submitted_currency, approved_amount } = parsed.data;

    // Verify period exists
    const { data: period } = await serviceClient
      .from("payroll_periods")
      .select("id")
      .eq("id", period_id)
      .single();
    if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

    // Verify employee exists
    const { data: employee } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", employee_id)
      .single();
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // Verify category exists and is active
    const { data: category } = await serviceClient
      .from("compensation_categories")
      .select("*")
      .eq("id", category_id)
      .single();
    if (!category || !category.is_active) {
      return NextResponse.json({ error: "Invalid compensation category" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("employee_compensations")
      .insert({
        employee_id,
        period_id,
        category_id,
        submitted_amount,
        submitted_currency,
        receipt_url: null,
        status: approved_amount != null ? "approved" : "pending",
        approved_amount: approved_amount ?? null,
        approved_at: approved_amount != null ? new Date().toISOString() : null,
      })
      .select("*, category:compensation_categories(*)")
      .single();

    if (error) return NextResponse.json({ error: "Failed to add compensation" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "compensation.admin_add",
      entityType: "employee_compensation",
      entityId: data.id,
      newValues: { employee_id, category: category.label, amount: submitted_amount, approved_amount },
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
