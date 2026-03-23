import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employee_id");

    // Validate UUID format if provided
    if (employeeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      return NextResponse.json({ error: "Invalid employee_id format" }, { status: 400 });
    }

    let query = serviceClient
      .from("payment_splits")
      .select("*, profile:profiles(first_name, last_name, email)")
      .order("sort_order");

    if (employeeId) query = query.eq("profile_id", employeeId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
