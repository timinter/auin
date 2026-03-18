import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("projects")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to delete project" }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
