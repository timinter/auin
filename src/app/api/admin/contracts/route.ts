import { requireRole } from "@/lib/auth";
import { createContractSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = createContractSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const { contract_type } = parsed.data;

    // For primary contracts, close the existing open primary contract
    if (contract_type === "primary") {
      await serviceClient
        .from("employee_contracts")
        .update({ effective_to: parsed.data.effective_from })
        .eq("employee_id", parsed.data.employee_id)
        .eq("contract_type", "primary")
        .is("effective_to", null)
        .is("terminated_at", null);
    }

    // Create new contract
    const { data, error } = await serviceClient
      .from("employee_contracts")
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to create contract" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
