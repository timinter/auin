import { requireAuth } from "@/lib/auth";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeText } from "@/lib/sanitize";

// Fields that employees/freelancers can edit themselves
const selfUpdateSchema = z.object({
  legal_address: z.string().max(500).transform(sanitizeText).transform((v) => v || null).optional(),
  personal_email: z.string().max(254).transform((v) => v || null).optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Invalid email" }),
  service_description: z.string().max(1000).transform(sanitizeText).transform((v) => v || null).optional(),
  payment_channel: z.enum(["BANK", "CRYPTO", "PAYONEER"]).optional().nullable(),
});

export async function PATCH(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = selfUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("profiles")
      .update(parsed.data)
      .eq("id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to update profile" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
