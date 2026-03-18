import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { UserRole } from "@/types";

type AuthResult =
  | { user: { id: string }; serviceClient: ReturnType<typeof createServiceRoleClient>; response?: never }
  | { user?: never; serviceClient?: never; response: NextResponse };

/**
 * Authenticate the request and verify the user has the required role.
 * Returns { user, serviceClient } on success, or { response } to return early.
 */
export async function requireRole(role: UserRole): Promise<AuthResult> {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const serviceClient = createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== role) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, serviceClient };
}

/**
 * Authenticate the request without role check.
 * Returns { user, serviceClient } on success, or { response } to return early.
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const serviceClient = createServiceRoleClient();
  return { user, serviceClient };
}
