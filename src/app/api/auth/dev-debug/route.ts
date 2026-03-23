import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * DEV-ONLY: Debug endpoint to check auth state.
 * Remove before production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check profiles
    const { data: profiles, error: profilesErr } = await adminClient
      .from("profiles")
      .select("id, email, role")
      .limit(5);

    // Check GoTrue users
    const { data: gotrueUsers, error: gotrueErr } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 5,
    });

    // Try to get a specific user if profiles exist
    let userCheck = null;
    if (profiles && profiles.length > 0) {
      const testEmail = profiles[0].email;
      const { data: byId, error: byIdErr } = await adminClient.auth.admin.getUserById(profiles[0].id);
      userCheck = {
        email: testEmail,
        profileId: profiles[0].id,
        gotrueFound: !!byId?.user,
        gotrueError: byIdErr?.message || null,
      };
    }

    return NextResponse.json({
      profileCount: profiles?.length ?? 0,
      profilesError: profilesErr?.message || null,
      profiles: profiles?.map((p) => ({ id: p.id, email: p.email, role: p.role })),
      gotrueUserCount: gotrueUsers?.users?.length ?? 0,
      gotrueError: gotrueErr?.message || null,
      gotrueUsers: gotrueUsers?.users?.map((u) => ({ id: u.id, email: u.email })),
      userCheck,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
