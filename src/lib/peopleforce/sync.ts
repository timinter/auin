import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEmployees, type PFEmployee } from "./client";

/** Map PeopleForce location name to SAMAP entity. */
export function mapLocationToEntity(locationName: string | undefined): string | null {
  if (!locationName) return null;
  const lower = locationName.toLowerCase();
  if (lower.includes("belarus") || lower.includes("by")) return "BY";
  if (lower.includes("united states") || lower.includes("us")) return "US";
  return null;
}

/** Map PeopleForce status to SAMAP status. */
export function mapStatus(pfStatus: string | undefined): "active" | "inactive" | null {
  if (!pfStatus) return null;
  const lower = pfStatus.toLowerCase();
  if (lower === "employed" || lower === "probation" || lower === "active") return "active";
  if (lower === "inactive" || lower === "terminated" || lower === "dismissed") return "inactive";
  return null;
}

/**
 * Sync employees from PeopleForce to SAMAP profiles.
 * Matches by email, updates department/status/position/entity/peopleforce_id.
 * Does NOT create new profiles — invitations handle that.
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
    .select("id, email, department, status, entity, peopleforce_id, contract_start_date")
    .in("role", ["employee", "freelancer"]);

  if (!profiles) {
    return { synced: 0, skipped: 0, errors: ["Failed to fetch SAMAP profiles"] };
  }

  const errors: string[] = [];

  // Build update payloads without executing queries
  const pendingUpdates: { id: string; email: string; updates: Record<string, unknown> }[] = [];
  let skipped = 0;

  for (const profile of profiles) {
    const pfData = pfByEmail.get(profile.email.toLowerCase());
    if (!pfData) {
      skipped++;
      continue;
    }

    const updates: Record<string, unknown> = {};

    if (pfData.id && pfData.id !== profile.peopleforce_id) {
      updates.peopleforce_id = pfData.id;
    }
    if (pfData.department?.name && pfData.department.name !== profile.department) {
      updates.department = pfData.department.name;
    }
    const mappedStatus = mapStatus(pfData.status);
    if (mappedStatus && mappedStatus !== profile.status) {
      updates.status = mappedStatus;
    }
    const mappedEntity = mapLocationToEntity(pfData.location?.name);
    if (mappedEntity && mappedEntity !== profile.entity) {
      updates.entity = mappedEntity;
    }
    if (pfData.hired_on && !profile.contract_start_date) {
      updates.contract_start_date = pfData.hired_on;
    }

    if (Object.keys(updates).length > 0) {
      pendingUpdates.push({ id: profile.id, email: profile.email, updates });
    } else {
      skipped++;
    }
  }

  // Execute all updates in parallel
  const results = await Promise.all(
    pendingUpdates.map(({ id, email, updates }) =>
      serviceClient
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .then(({ error }) => {
          if (error) errors.push(`Failed to update ${email}: ${error.code} - ${error.message}`);
          return !error;
        })
    )
  );

  const synced = results.filter(Boolean).length;

  return { synced, skipped, errors };
}
