import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { inviteSchema } from "@/lib/validations";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const token = randomUUID();
    const { error } = await serviceClient.from("invitations").insert({
      email: parsed.data.email,
      role: parsed.data.role,
      entity: parsed.data.entity,
      token,
      invited_by: user.id,
    });

    if (error) return NextResponse.json({ error: "Failed to create invitation" }, { status: 400 });

    return NextResponse.json({ inviteLink: `${env.NEXT_PUBLIC_SITE_URL}/invite/${token}` });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
