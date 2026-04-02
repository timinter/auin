import { requireRole } from "@/lib/auth";
import { uuidParam } from "@/lib/validations";
import { calculateWorkingDays } from "@/lib/working-days";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!uuidParam.safeParse(params.id).success) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Fetch the holiday date before deleting so we can recalculate
    const { data: holiday } = await serviceClient
      .from("corporate_holidays")
      .select("date")
      .eq("id", params.id)
      .single();

    const { error } = await serviceClient
      .from("corporate_holidays")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: "Failed to delete holiday" }, { status: 400 });

    // Recalculate working_days for affected periods
    if (holiday) {
      const [yearStr, monthStr] = holiday.date.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      const { data: periods } = await serviceClient
        .from("payroll_periods")
        .select("id")
        .eq("year", year)
        .eq("month", month);

      if (periods && periods.length > 0) {
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
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
