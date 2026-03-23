import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(200),
});

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
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
