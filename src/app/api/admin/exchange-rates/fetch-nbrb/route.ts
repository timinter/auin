import { requireRole } from "@/lib/auth";
import { fetchNbrbRate, getRateDate } from "@/lib/nbrb";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const body = await request.json();
    const parsed = z.object({ period_id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid period_id" }, { status: 400 });
    }

    // Get period to determine year/month
    const { data: period } = await serviceClient
      .from("payroll_periods")
      .select("year, month")
      .eq("id", parsed.data.period_id)
      .single();

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Fetch rate from NBRB for last day of the month
    const rateDate = getRateDate(period.year, period.month);
    const { rate } = await fetchNbrbRate(rateDate);

    // Upsert into exchange_rates
    const { data, error } = await serviceClient
      .from("exchange_rates")
      .upsert(
        {
          period_id: parsed.data.period_id,
          from_currency: "BYN",
          to_currency: "USD",
          rate,
          rate_date: rateDate,
        },
        { onConflict: "period_id,from_currency,to_currency" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save exchange rate" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("NBRB fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch NBRB rate" }, { status: 500 });
  }
}
