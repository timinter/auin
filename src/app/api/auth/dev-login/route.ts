import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * DEV-ONLY: Sign in as any seeded user.
 * Uses the same SSR client the rest of the app uses (createServerSupabaseClient).
 * The seed sets all test users' password to "password123".
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: "password123",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Dev login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
