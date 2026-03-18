import { requireRole } from "@/lib/auth";
import { updateContractSchema, terminateContractSchema, uuidParam } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";

// GET single contract
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("employee_contracts")
      .select("*, employee:profiles(id, first_name, last_name, email)")
      .eq("id", params.id)
      .single();

    if (error) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — update contract fields (notes, effective_to)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid contract ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateContractSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Get existing contract for audit
    const { data: existing } = await serviceClient
      .from("employee_contracts")
      .select("*")
      .eq("id", params.id)
      .single();
    if (!existing) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
    if (parsed.data.effective_to !== undefined) updates.effective_to = parsed.data.effective_to;

    const { data, error } = await serviceClient
      .from("employee_contracts")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to update contract" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "contract.update",
      entityType: "employee_contract",
      entityId: params.id,
      oldValues: existing,
      newValues: updates,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/contracts/[id] with ?action=terminate
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = terminateContractSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const { data: existing } = await serviceClient
      .from("employee_contracts")
      .select("*")
      .eq("id", params.id)
      .single();
    if (!existing) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    if (existing.terminated_at) return NextResponse.json({ error: "Contract already terminated" }, { status: 400 });

    const { data, error } = await serviceClient
      .from("employee_contracts")
      .update({
        terminated_at: parsed.data.terminated_at,
        terminated_by: user.id,
        effective_to: parsed.data.terminated_at,
        notes: parsed.data.notes
          ? `${existing.notes ? existing.notes + "\n" : ""}Terminated: ${parsed.data.notes}`
          : existing.notes,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to terminate contract" }, { status: 400 });

    await createAuditLog(serviceClient, {
      userId: user.id,
      action: "contract.terminate",
      entityType: "employee_contract",
      entityId: params.id,
      oldValues: existing,
      newValues: data,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
