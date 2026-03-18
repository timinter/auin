import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite_token");

  if (code) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If this is an invite flow, mark invitation as accepted
      if (inviteToken) {
        const serviceClient = createServiceRoleClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // Get invitation
          const { data: invitation } = await serviceClient
            .from("invitations")
            .select("*")
            .eq("token", inviteToken)
            .is("accepted_at", null)
            .single();

          if (invitation && invitation.email === user.email) {
            // Update profile with invitation role and entity
            await serviceClient
              .from("profiles")
              .update({ role: invitation.role, entity: invitation.entity })
              .eq("id", user.id);

            // Mark invitation as accepted
            await serviceClient
              .from("invitations")
              .update({ accepted_at: new Date().toISOString() })
              .eq("id", invitation.id);
          }
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
