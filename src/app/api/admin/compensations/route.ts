import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { NextResponse } from "next/server";
import { z } from "zod";

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
      .select("*, category:compensation_categories(*), employee:profiles!inner(*), period:payroll_periods(*)")
      .order("created_at", { ascending: false });

    if (periodId) query = query.eq("period_id", periodId);
    if (entity) query = query.eq("employee.entity", entity);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to load compensations" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
