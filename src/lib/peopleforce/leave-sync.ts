import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLeaveRequests } from "./client";

/** PeopleForce leave type IDs */
const PF_LEAVE_TYPE = {
  VACATION: 14100,
  DAY_OFF: 14101,
  SICK_LEAVE: 14102,
  UNPAID_LEAVE: 14718,
  MEDICAL_INSURANCE: 14618,
} as const;

/** Map PF leave type ID to SAMAP leave_type string. */
export function mapLeaveType(pfLeaveTypeId: number): string | null {
  switch (pfLeaveTypeId) {
    case PF_LEAVE_TYPE.VACATION: return "vacation";
    case PF_LEAVE_TYPE.SICK_LEAVE: return "sick";
    case PF_LEAVE_TYPE.UNPAID_LEAVE: return "unpaid";
    case PF_LEAVE_TYPE.DAY_OFF: return "day_off";
    default: return null; // Medical insurance is not a leave type in SAMAP
  }
}

/** Count leave days that fall within a given month. */
export function countDaysInMonth(
  startDate: string,
  endDate: string,
  year: number,
  month: number
): number {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // Last day of month

  // Parse YYYY-MM-DD as local time to avoid UTC timezone shift
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const leaveStart = new Date(sy, sm - 1, sd);
  const leaveEnd = new Date(ey, em - 1, ed);

  const effectiveStart = leaveStart > monthStart ? leaveStart : monthStart;
  const effectiveEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;

  if (effectiveStart > effectiveEnd) return 0;

  let count = 0;
  const current = new Date(effectiveStart);
  while (current <= effectiveEnd) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++; // Skip weekends
    current.setDate(current.getDate() + 1);
  }
  return count;
}

interface LeaveSyncResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Sync approved leaves from PeopleForce for a specific period.
 * Creates leave_requests in SAMAP, deduplicating by external_id.
 */
export async function syncLeavesFromPeopleForce(
  serviceClient: SupabaseClient,
  periodId: string,
  year: number,
  month: number
): Promise<LeaveSyncResult> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  // Fetch approved leaves from PeopleForce
  const pfLeaves = await fetchLeaveRequests(startDate, endDate);
  if (pfLeaves.length === 0) {
    return { imported: 0, skipped: 0, errors: [] };
  }

  // Build email → profile map from SAMAP
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, email")
    .in("role", ["employee", "freelancer"]);

  if (!profiles) {
    return { imported: 0, skipped: 0, errors: ["Failed to fetch SAMAP profiles"] };
  }

  const profileByEmail = new Map<string, { id: string; email: string }>();
  for (const p of profiles) {
    profileByEmail.set(p.email.toLowerCase(), p);
  }

  // Check which external_ids already exist
  const externalIds = pfLeaves.map((lr) => `pf_${lr.id}`);
  const { data: existing } = await serviceClient
    .from("leave_requests")
    .select("external_id")
    .in("external_id", externalIds);

  const existingSet = new Set((existing || []).map((e: { external_id: string }) => e.external_id));

  let skipped = 0;
  const errors: string[] = [];

  // Build batch of rows to insert
  const rowsToInsert: Record<string, unknown>[] = [];

  for (const pfLeave of pfLeaves) {
    const externalId = `pf_${pfLeave.id}`;

    if (existingSet.has(externalId)) { skipped++; continue; }

    const leaveType = mapLeaveType(pfLeave.leave_type_id);
    if (!leaveType) { skipped++; continue; }

    const email = pfLeave.employee.email.toLowerCase();
    const profile = profileByEmail.get(email);
    if (!profile) { skipped++; continue; }

    const daysCount = countDaysInMonth(pfLeave.starts_on, pfLeave.ends_on, year, month);
    if (daysCount === 0) { skipped++; continue; }

    const clampedStart = pfLeave.starts_on < startDate ? startDate : pfLeave.starts_on;
    const clampedEnd = pfLeave.ends_on > endDate ? endDate : pfLeave.ends_on;

    rowsToInsert.push({
      employee_id: profile.id,
      period_id: periodId,
      leave_type: leaveType,
      start_date: clampedStart,
      end_date: clampedEnd,
      days_count: daysCount,
      reason: pfLeave.comment || `Synced from PeopleForce (${pfLeave.leave_type})`,
      status: "approved",
      source: "peopleforce",
      external_id: externalId,
    });
  }

  // Single batch insert
  let imported = 0;
  if (rowsToInsert.length > 0) {
    const { error, count } = await serviceClient
      .from("leave_requests")
      .insert(rowsToInsert);

    if (error) {
      errors.push(`Batch insert failed: ${error.code} - ${error.message}`);
    } else {
      imported = count ?? rowsToInsert.length;
    }
  }

  return { imported, skipped, errors };
}
