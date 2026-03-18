import { requireAuth } from "@/lib/auth";
import { bankDetailsSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = bankDetailsSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("profiles")
      .update({ bank_details: parsed.data })
      .eq("id", user.id)
      .select("bank_details")
      .single();

    if (error) return NextResponse.json({ error: "Failed to save bank details" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
