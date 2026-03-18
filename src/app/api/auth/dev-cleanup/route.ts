import { createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * DEV-ONLY: Delete all test users via GoTrue admin API.
 * This lets GoTrue handle its own FK cleanup properly,
 * unlike raw SQL which misses internal auth dependencies.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();

    // List all users via GoTrue admin API
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 });
    }

    const keep = "timofey.bykov@interexy.com";
    const toDelete = users.filter(
      (u) => u.email?.endsWith("@interexy.com") && u.email !== keep
    );

    let deleted = 0;
    const errors: string[] = [];

    for (const user of toDelete) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) {
        errors.push(`${user.email}: ${error.message}`);
      } else {
        deleted++;
      }
    }

    return NextResponse.json({ deleted, errors, total: toDelete.length });
  } catch (err) {
    console.error("Dev cleanup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
