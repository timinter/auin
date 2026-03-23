import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  email: z.string().email(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * GET /api/admin/jira/worklogs?email=...&start_date=...&end_date=...
 *
 * Returns total hours logged by a user in a date range from Jira.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      email: url.searchParams.get("email"),
      start_date: url.searchParams.get("start_date"),
      end_date: url.searchParams.get("end_date"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const { email, start_date, end_date } = parsed.data;

    try {
      const { fetchUserWorklogHours } = await import("@/lib/jira/client");
      const hours = await fetchUserWorklogHours(email, start_date, end_date);

      if (hours === null) {
        return NextResponse.json(
          { error: "Jira not configured", configured: false },
          { status: 503 }
        );
      }

      return NextResponse.json({ hours, configured: true });
    } catch (err) {
      console.error(err);
      return NextResponse.json(
        { error: "Failed to fetch Jira worklogs" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
