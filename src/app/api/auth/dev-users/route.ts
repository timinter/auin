import { createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * DEV-ONLY: List all profiles for the dev login picker.
 * Uses service role client to bypass RLS.
 * Columns are from public.profiles (verified in 00001_initial_schema.sql).
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, role, department, payment_channel")
      .order("role")
      .order("last_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
