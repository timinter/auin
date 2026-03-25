const DEFAULT_API_URL = "https://app.peopleforce.io/api/public/v3";

interface PeopleForceConfig {
  apiKey: string;
  baseUrl: string;
}

function getConfig(): PeopleForceConfig | null {
  const apiKey = process.env.PEOPLEFORCE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.PEOPLEFORCE_API_URL || DEFAULT_API_URL,
  };
}

async function pfFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      ...options,
      headers: {
        "X-API-KEY": config.apiKey,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      console.error(`PeopleForce API error: ${res.status} ${path}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error("PeopleForce fetch error:", err);
    return null;
  }
}

// --- Types matching v3 API response shapes ---

export interface PFEmployee {
  id: number;
  status: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  personal_email: string | null;
  hired_on: string | null;
  position: { id: number; name: string } | null;
  department: { id: number; name: string } | null;
  location: { id: number; name: string } | null;
  employment_type: { id: number; name: string } | null;
}

export interface PFLeaveRequest {
  id: number;
  employee_id: number;
  leave_type_id: number;
  leave_type: string;
  state: string;
  amount: string;
  tracking_time_in: string;
  starts_on: string;
  ends_on: string;
  comment: string;
  employee: { id: number; first_name: string; last_name: string; email: string };
  entries: { date: string; amount: string }[];
}

export interface PFLeaveBalance {
  id: number;
  effective_on: string;
  balance: number;
  leave_type_policy: { id: number; name: string };
  leave_type: { id: number; name: string; unit: string };
}

interface PFPaginatedResponse<T> {
  data: T[];
  metadata: {
    pagination: {
      page: number;
      pages: number;
      count: number;
      items: number;
    };
  };
}

interface PFListResponse<T> {
  data: T[];
}

// --- API Functions ---

/**
 * Fetch all employees from PeopleForce (paginated).
 */
export async function fetchEmployees(): Promise<PFEmployee[]> {
  const all: PFEmployee[] = [];
  let page = 1;

  while (true) {
    const result = await pfFetch<PFPaginatedResponse<PFEmployee>>(
      `/employees?page=${page}&per_page=100`
    );
    if (!result) break;

    all.push(...result.data);
    if (page >= result.metadata.pagination.pages) break;
    page++;
  }

  return all;
}

/**
 * Fetch leave requests from PeopleForce for a date range.
 * Only fetches approved leaves by default.
 */
export async function fetchLeaveRequests(
  startDate: string,
  endDate: string,
  options?: { leaveTypeId?: number; state?: string }
): Promise<PFLeaveRequest[]> {
  const all: PFLeaveRequest[] = [];
  let page = 1;
  const state = options?.state || "approved";

  while (true) {
    let path = `/leave_requests?page=${page}&per_page=100&state=${state}`;
    if (options?.leaveTypeId) path += `&leave_type_id=${options.leaveTypeId}`;

    const result = await pfFetch<PFPaginatedResponse<PFLeaveRequest>>(path);
    if (!result) break;

    // Filter by date range client-side (API filter unreliable in v3)
    for (const lr of result.data) {
      if (lr.ends_on >= startDate && lr.starts_on <= endDate) {
        all.push(lr);
      }
    }

    if (page >= result.metadata.pagination.pages) break;
    page++;
  }

  return all;
}

/**
 * Fetch leave balances for a specific employee.
 */
export async function fetchLeaveBalances(
  employeeId: number
): Promise<PFLeaveBalance[]> {
  const result = await pfFetch<PFListResponse<PFLeaveBalance>>(
    `/employees/${employeeId}/leave_balances`
  );
  return result?.data || [];
}

/**
 * Check if PeopleForce is configured.
 */
export function isConfigured(): boolean {
  return getConfig() !== null;
}

// Exported for testing
export { getConfig, pfFetch };
