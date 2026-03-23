import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const upsertRateSchema = z.object({
  period_id: z.string().uuid(),
  from_currency: z.string().regex(/^[A-Z]{3,4}$/, "Must be a valid currency code"),
  to_currency: z.string().regex(/^[A-Z]{3,4}$/, "Must be a valid currency code").default("USD"),
  rate: z.number().positive().max(999_999),
  rate_date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Must be YYYY-MM-DD"),
});

export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const periodId = url.searchParams.get("period_id");

    if (periodId && !z.string().uuid().safeParse(periodId).success) {
      return NextResponse.json({ error: "Invalid period_id" }, { status: 400 });
    }

    let query = serviceClient.from("exchange_rates").select("*").order("from_currency");
    if (periodId) query = query.eq("period_id", periodId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to load exchange rates" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const body = await request.json();
    const parsed = upsertRateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("exchange_rates")
      .upsert(parsed.data, { onConflict: "period_id,from_currency,to_currency" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to save exchange rate" }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
