import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employee_id");

    if (!employeeId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(employeeId)) {
      return NextResponse.json({ error: "Valid employee_id is required" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("bank_accounts")
      .select("*")
      .eq("profile_id", employeeId)
      .order("sort_order");

    if (error) return NextResponse.json({ error: "Failed to load bank accounts" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
