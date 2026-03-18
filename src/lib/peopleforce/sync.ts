import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEmployees, type PFEmployee } from "./client";

/**
 * Sync employees from PeopleForce to SAMAP profiles.
 * Only updates department and status for existing users (matched by email).
 * Does NOT create new profiles — invitations handle that.
 *
 * Returns the number of profiles updated.
 */
export async function syncEmployeesFromPeopleForce(
  serviceClient: SupabaseClient
): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const pfEmployees = await fetchEmployees();
  if (pfEmployees.length === 0) {
    return { synced: 0, skipped: 0, errors: ["No employees returned from PeopleForce or API not configured"] };
  }

  // Build email -> PF data map
  const pfByEmail = new Map<string, PFEmployee>();
  for (const emp of pfEmployees) {
    if (emp.email) {
      pfByEmail.set(emp.email.toLowerCase(), emp);
    }
  }

  // Fetch all SAMAP profiles
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, email, department, status")
    .in("role", ["employee", "freelancer"]);

  if (!profiles) {
    return { synced: 0, skipped: 0, errors: ["Failed to fetch SAMAP profiles"] };
  }

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const profile of profiles) {
    const pfData = pfByEmail.get(profile.email.toLowerCase());
    if (!pfData) {
      skipped++;
      continue;
    }

    const updates: Record<string, unknown> = {};

    // Sync department if available and different
    if (pfData.department?.name && pfData.department.name !== profile.department) {
      updates.department = pfData.department.name;
    }

    // Sync status (PeopleForce "active"/"inactive" maps directly)
    if (pfData.status && pfData.status !== profile.status) {
      const mappedStatus = pfData.status === "active" ? "active" : "inactive";
      if (mappedStatus !== profile.status) {
        updates.status = mappedStatus;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await serviceClient
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);

      if (error) {
        errors.push(`Failed to update ${profile.email}: ${error.code}`);
      } else {
        synced++;
      }
    } else {
      skipped++;
    }
  }

  return { synced, skipped, errors };
}
