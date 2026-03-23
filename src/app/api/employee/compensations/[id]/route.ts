import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("employee");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid compensation ID" }, { status: 400 });
    }

    // Verify ownership and pending status
    const { data: comp } = await serviceClient
      .from("employee_compensations")
      .select("employee_id, status")
      .eq("id", params.id)
      .single();

    if (!comp) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (comp.employee_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (comp.status !== "pending") return NextResponse.json({ error: "Can only delete pending compensations" }, { status: 400 });

    const { error } = await serviceClient
      .from("employee_compensations")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to delete compensation" }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
