import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { data, error } = await serviceClient
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: "Failed to load notifications" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Mark notifications as read */
export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const ids: string[] = body.ids;
    const markAll: boolean = body.mark_all;

    if (markAll) {
      await serviceClient
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    } else if (Array.isArray(ids) && ids.length > 0) {
      await serviceClient
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .in("id", ids);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
