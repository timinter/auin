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

    // Fetch all balances in parallel
    const balanceResults = await Promise.all(
      profiles.map(async (profile) => {
        const balances = await fetchLeaveBalances(profile.peopleforce_id);
        const medical = balances.find((b) => b.leave_type.id === MEDICAL_INSURANCE_TYPE_ID);
        if (!medical) return null;

        // PF balance = remaining amount (positive = unused dollars)
        // Policy name contains the annual limit, e.g. "Медицинская страховка 450$ / год"
        const policyName = medical.leave_type_policy?.name || "";
        const limitMatch = policyName.match(/(\d+)\$/);
        const annualLimit = limitMatch ? parseInt(limitMatch[1]) : 450;
        const remaining = Math.max(0, medical.balance);
        const used = Math.max(0, annualLimit - remaining);

        return {
          employee_id: profile.id,
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`,
          annual_limit: annualLimit,
          used: Math.round(used * 100) / 100,
          remaining: Math.round(remaining * 100) / 100,
        };
      })
    );

    return NextResponse.json(balanceResults.filter(Boolean));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
