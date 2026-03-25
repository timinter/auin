import { requireRole } from "@/lib/auth";
import { fetchLeaveBalances, isConfigured } from "@/lib/peopleforce/client";
import { NextResponse } from "next/server";

const MEDICAL_INSURANCE_TYPE_ID = 14618;

export async function GET() {
  try {
    const auth = await requireRole("admin");
    if (auth.response) return auth.response;
    const { serviceClient } = auth;

    if (!isConfigured()) {
      return NextResponse.json({ error: "PeopleForce is not configured" }, { status: 503 });
    }

    // Fetch SAMAP profiles with PF IDs
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, email, first_name, last_name, peopleforce_id")
      .in("role", ["employee", "freelancer"])
      .not("peopleforce_id", "is", null);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json([]);
    }

    const results = [];

    for (const profile of profiles) {
      const balances = await fetchLeaveBalances(profile.peopleforce_id);
      const medical = balances.find((b) => b.leave_type.id === MEDICAL_INSURANCE_TYPE_ID);

      if (medical) {
        // PF stores balance as negative "hours" (actually dollars)
        // Policy name contains the annual limit, e.g. "Медицинская страховка 450$ / год"
        const policyName = medical.leave_type_policy?.name || "";
        const limitMatch = policyName.match(/(\d+)\$/);
        const annualLimit = limitMatch ? parseInt(limitMatch[1]) : 450;
        const used = Math.abs(medical.balance);
        const remaining = Math.max(0, annualLimit - used);

        results.push({
          employee_id: profile.id,
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`,
          annual_limit: annualLimit,
          used: Math.round(used * 100) / 100,
          remaining: Math.round(remaining * 100) / 100,
        });
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
