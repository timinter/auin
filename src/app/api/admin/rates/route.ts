import { requireRole } from "@/lib/auth";
import { createRateSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = createRateSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Close existing open rate for same freelancer+project
    await serviceClient
      .from("freelancer_project_rates")
      .update({ effective_to: parsed.data.effective_from })
      .eq("freelancer_id", parsed.data.freelancer_id)
      .eq("project_id", parsed.data.project_id)
      .is("effective_to", null);

    // Create new rate
    const { data, error } = await serviceClient
      .from("freelancer_project_rates")
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to create rate" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
