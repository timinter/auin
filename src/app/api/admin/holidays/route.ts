import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateWorkingDays } from "@/lib/working-days";
import type { SupabaseClient } from "@supabase/supabase-js";

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(200),
});

/**
 * Recalculate working_days for any period whose month contains
 * the given holiday date, then update the DB.
 */
async function recalcPeriodWorkingDays(serviceClient: SupabaseClient, holidayDate: string) {
  const [yearStr, monthStr] = holidayDate.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  // Find periods matching this year/month
  const { data: periods } = await serviceClient
    .from("payroll_periods")
    .select("id, year, month")
    .eq("year", year)
    .eq("month", month);

  if (!periods || periods.length === 0) return;

  // Fetch ALL holidays for this month (after the insert/delete has happened)
  const { data: holidays } = await serviceClient
    .from("corporate_holidays")
    .select("date")
    .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
    .lte("date", `${year}-${String(month).padStart(2, "0")}-31`);

  const holidayDates = (holidays || []).map((h: { date: string }) => h.date);
  const newWorkingDays = calculateWorkingDays(year, month, holidayDates);

  for (const period of periods) {
    await serviceClient
      .from("payroll_periods")
      .update({ working_days: newWorkingDays })
      .eq("id", period.id);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    const url = new URL(request.url);
    const year = url.searchParams.get("year");

    if (year && (!/^\d{4}$/.test(year) || +year < 2020 || +year > 2100)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    let query = serviceClient
      .from("corporate_holidays")
      .select("*")
      .order("date");

    if (year) {
      query = query.gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to load holidays" }, { status: 400 });
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
    const parsed = holidaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("corporate_holidays")
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Holiday already exists for this date" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create holiday" }, { status: 400 });
    }

    // Recalculate working_days for any period in the same month
    await recalcPeriodWorkingDays(serviceClient, parsed.data.date);

    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
