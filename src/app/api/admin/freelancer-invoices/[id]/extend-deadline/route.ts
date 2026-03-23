import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("freelancer_invoices")
      .update({ deadline_override: true })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to extend deadline" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "freelancer_invoice.deadline_override",
      entityType: "freelancer_invoice",
      entityId: params.id,
      newValues: { deadline_override: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
