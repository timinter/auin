import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const periodId = url.searchParams.get("period_id");
    const status = url.searchParams.get("status");
    const entity = url.searchParams.get("entity");

    let query = serviceClient
      .from("leave_requests")
      .select("*, employee:profiles!employee_id(*), period:payroll_periods(*), reviewer:profiles!reviewed_by(first_name, last_name)")
      .order("created_at", { ascending: false });

    if (periodId) query = query.eq("period_id", periodId);
    if (status && status !== "all") query = query.eq("status", status);
    if (entity) {
      // Filter by employee entity — need a sub-select approach
      // We'll filter client-side since Supabase doesn't support filtering on joined fields directly in all cases
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });

    // Filter by entity client-side if needed
    const filtered = entity
      ? (data || []).filter((l: Record<string, unknown>) => {
          const emp = l.employee as { entity?: string } | null;
          return emp?.entity === entity;
        })
      : data;

    return NextResponse.json(filtered);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
