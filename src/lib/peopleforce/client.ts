const PEOPLEFORCE_API_URL = "https://api.peopleforce.io/api/v2";

interface PeopleForceConfig {
  apiKey: string;
  baseUrl: string;
}

function getConfig(): PeopleForceConfig | null {
  const apiKey = process.env.PEOPLEFORCE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.PEOPLEFORCE_API_URL || PEOPLEFORCE_API_URL,
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
        "X-API-Key": config.apiKey,
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

export interface PFEmployee {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  position?: string;
  department?: { id: number; name: string };
  hire_date?: string;
  status?: string;
}

interface PFListResponse<T> {
  data: T[];
  meta: { current_page: number; total_pages: number; total_count: number };
}

/**
 * Fetch all employees from PeopleForce.
 * Handles pagination automatically.
 */
export async function fetchEmployees(): Promise<PFEmployee[]> {
  const all: PFEmployee[] = [];
  let page = 1;

  while (true) {
    const result = await pfFetch<PFListResponse<PFEmployee>>(
      `/employees?page=${page}&per_page=100`
    );
    if (!result) break;

    all.push(...result.data);
    if (page >= result.meta.total_pages) break;
    page++;
  }

  return all;
}

export interface PFTimeOff {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  time_off_policy?: { name: string };
}

/**
 * Fetch time-off records for a date range.
 */
export async function fetchTimeOffs(
  startDate: string,
  endDate: string
): Promise<PFTimeOff[]> {
  const result = await pfFetch<PFListResponse<PFTimeOff>>(
    `/time_offs?start_date=${startDate}&end_date=${endDate}&per_page=200`
  );
  return result?.data || [];
}
