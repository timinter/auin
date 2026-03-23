import { requireRole } from "@/lib/auth";
import { createPeriodSchema, updatePeriodSchema, uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const { data, error } = await serviceClient
      .from("payroll_periods")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) return NextResponse.json({ error: "Failed to load periods" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (auth.response) return auth.response;
  const { serviceClient } = auth;

  const body = await request.json();
  const parsed = createPeriodSchema.safeParse(body);
  if (!parsed.success) {
    const { fieldErrors, message } = formatZodErrors(parsed.error);
    return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
  }

  // Calculate default deadlines
  const { year, month } = parsed.data;
  // Next month's 10th for submission, 20th for payment
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const submission_deadline = `${nextYear}-${String(nextMonth).padStart(2, "0")}-10`;
  const payment_deadline = `${nextYear}-${String(nextMonth).padStart(2, "0")}-20`;

  const { data, error } = await serviceClient
    .from("payroll_periods")
    .insert({ ...parsed.data, submission_deadline, payment_deadline })
    .select()
    .single();
  if (error) return NextResponse.json({ error: "Failed to save period" }, { status: 400 });

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const auth = await requireRole("admin");
  if (auth.response) return auth.response;
  const { serviceClient } = auth;

  const body = await request.json();
  const parsed = updatePeriodSchema.safeParse(body);
  if (!parsed.success) {
    const { fieldErrors, message } = formatZodErrors(parsed.error);
    return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
  }

  const { data, error } = await serviceClient
    .from("payroll_periods")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to save period" }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { id } = await request.json();
    if (!uuidParam.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid period ID" }, { status: 400 });
    }

    // Check for associated payroll records
    const { count: payrollCount } = await serviceClient
      .from("payroll_records")
      .select("id", { count: "exact", head: true })
      .eq("period_id", id);

    // Check for associated freelancer invoices
    const { count: invoiceCount } = await serviceClient
      .from("freelancer_invoices")
      .select("id", { count: "exact", head: true })
      .eq("period_id", id);

    // Check for associated compensations
    const { count: compCount } = await serviceClient
      .from("employee_compensations")
      .select("id", { count: "exact", head: true })
      .eq("period_id", id);

    const totalRecords = (payrollCount || 0) + (invoiceCount || 0) + (compCount || 0);

    if (totalRecords > 0) {
      // Delete all associated records
      await Promise.all([
        payrollCount && payrollCount > 0
          ? serviceClient.from("payroll_records").delete().eq("period_id", id)
          : Promise.resolve(),
        invoiceCount && invoiceCount > 0
          ? serviceClient.from("freelancer_invoices").delete().eq("period_id", id)
          : Promise.resolve(),
        compCount && compCount > 0
          ? serviceClient.from("employee_compensations").delete().eq("period_id", id)
          : Promise.resolve(),
      ]);
    }

    const { error } = await serviceClient
      .from("payroll_periods")
      .delete()
      .eq("id", id);

    if (error) return NextResponse.json({ error: "Failed to delete period" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "period.delete",
      entityType: "payroll_period",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
