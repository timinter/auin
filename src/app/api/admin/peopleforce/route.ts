import { requireRole } from "@/lib/auth";
import { syncEmployeesFromPeopleForce } from "@/lib/peopleforce/sync";
import { syncLeavesFromPeopleForce } from "@/lib/peopleforce/leave-sync";
import { isConfigured } from "@/lib/peopleforce/client";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const leaveSyncSchema = z.object({
  action: z.literal("sync_leaves"),
  period_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2099),
  month: z.number().int().min(1).max(12),
});

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!isConfigured()) {
      return NextResponse.json({ error: "PeopleForce is not configured" }, { status: 503 });
    }

    const body = await request.json();

    // Leave sync
    if (body.action === "sync_leaves") {
      const parsed = leaveSyncSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }

      const result = await syncLeavesFromPeopleForce(
        serviceClient,
        parsed.data.period_id,
        parsed.data.year,
        parsed.data.month
      );

      await createAuditLog(serviceClient, {
        userId: user.id,
        action: "peopleforce.sync_leaves",
        entityType: "payroll_period",
        entityId: parsed.data.period_id,
        newValues: { imported: result.imported, skipped: result.skipped },
      });

      return NextResponse.json(result);
    }

    // Default: employee sync
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
