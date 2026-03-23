import { requireRole } from "@/lib/auth";
import { syncEmployeesFromPeopleForce } from "@/lib/peopleforce/sync";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const result = await syncEmployeesFromPeopleForce(serviceClient);

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "peopleforce.sync",
      entityType: "system",
      entityId: "peopleforce",
      newValues: { synced: result.synced, skipped: result.skipped },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
