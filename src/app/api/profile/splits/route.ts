import { requireAuth } from "@/lib/auth";
import { formatZodErrors } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const splitSchema = z.object({
  payment_channel: z.enum(["AMC", "Interexy", "CRYPTO", "BANK", "PAYONEER"]),
  percentage: z.number().positive().max(100),
  bank_details: z.object({
    bank_name: z.string().max(100).optional().default(""),
    account_number: z.string().max(34).optional().default(""),
    swift: z.string().max(11).optional().default(""),
    iban: z.string().max(42).optional().default(""),
    bank_address: z.string().max(200).optional().default(""),
  }).optional().nullable(),
});

const updateSplitsSchema = z.object({
  splits: z.array(splitSchema).min(1).max(5),
}).refine(
  (data) => {
    const total = data.splits.reduce((s, sp) => s + sp.percentage, 0);
    return Math.abs(total - 100) < 0.01;
  },
  { message: "Split percentages must add up to 100%", path: ["splits"] }
);

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { data, error } = await serviceClient
      .from("payment_splits")
      .select("*")
      .eq("profile_id", user.id)
      .order("sort_order");

    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const body = await request.json();
    const parsed = updateSplitsSchema.safeParse(body);
    if (!parsed.success) {
      const { fieldErrors, message } = formatZodErrors(parsed.error);
      return NextResponse.json({ error: message, fieldErrors }, { status: 400 });
    }

    // Delete existing splits and replace with new ones
    await serviceClient
      .from("payment_splits")
      .delete()
      .eq("profile_id", user.id);

    const rows = parsed.data.splits.map((sp, idx) => ({
      profile_id: user.id,
      payment_channel: sp.payment_channel,
      percentage: sp.percentage,
      bank_details: sp.bank_details || null,
      sort_order: idx,
    }));

    const { data, error } = await serviceClient
      .from("payment_splits")
      .insert(rows)
      .select();

    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const auth = await requireAuth();
    if (auth.response) return auth.response;
    const { user, serviceClient } = auth;

    const { error } = await serviceClient
      .from("payment_splits")
      .delete()
      .eq("profile_id", user.id);

    if (error) return NextResponse.json({ error: "Operation failed" }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
