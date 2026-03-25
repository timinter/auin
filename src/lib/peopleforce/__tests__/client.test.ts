import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must set env before importing client
const MOCK_API_KEY = "test-api-key-123";

beforeEach(() => {
  process.env.PEOPLEFORCE_API_KEY = MOCK_API_KEY;
  delete process.env.PEOPLEFORCE_API_URL;
});

afterEach(() => {
  delete process.env.PEOPLEFORCE_API_KEY;
  vi.restoreAllMocks();
});

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce({
    ok,
    status,
    json: async () => data,
  } as Response);
}

function mockPaginatedResponse<T>(pages: T[][]) {
  const fetchSpy = vi.spyOn(global, "fetch");
  for (let i = 0; i < pages.length; i++) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: pages[i],
        metadata: {
          pagination: {
            page: i + 1,
            pages: pages.length,
            count: pages.reduce((sum, p) => sum + p.length, 0),
            items: 100,
          },
        },
      }),
    } as Response);
  }
  return fetchSpy;
}

describe("PeopleForce Client", () => {
  describe("fetchEmployees", () => {
    it("fetches all employees with pagination", async () => {
      const { fetchEmployees } = await import("../client");
      const page1 = [{ id: 1, email: "a@test.com", first_name: "A", last_name: "B" }];
      const page2 = [{ id: 2, email: "b@test.com", first_name: "C", last_name: "D" }];
      mockPaginatedResponse([page1, page2]);

      const result = await fetchEmployees();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("sends correct auth header", async () => {
      const { fetchEmployees } = await import("../client");
      mockPaginatedResponse([[{ id: 1 }]]);

      await fetchEmployees();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/employees"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-KEY": MOCK_API_KEY,
          }),
        })
      );
    });

    it("returns empty array when API key is missing", async () => {
      delete process.env.PEOPLEFORCE_API_KEY;
      vi.resetModules();
      const { fetchEmployees } = await import("../client");
      const spy = vi.spyOn(global, "fetch");

      const result = await fetchEmployees();
      expect(result).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it("returns empty array on API error", async () => {
      const { fetchEmployees } = await import("../client");
      mockFetchResponse({}, false, 500);
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await fetchEmployees();
      expect(result).toEqual([]);
    });

    it("returns empty array on network error", async () => {
      const { fetchEmployees } = await import("../client");
      vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network error"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await fetchEmployees();
      expect(result).toEqual([]);
    });
  });

  describe("fetchLeaveRequests", () => {
    it("filters by date range client-side", async () => {
      const { fetchLeaveRequests } = await import("../client");
      const leaves = [
        { id: 1, starts_on: "2026-03-05", ends_on: "2026-03-07", state: "approved" },
        { id: 2, starts_on: "2026-02-01", ends_on: "2026-02-03", state: "approved" },
        { id: 3, starts_on: "2026-03-28", ends_on: "2026-04-02", state: "approved" },
      ];
      mockPaginatedResponse([leaves]);

      const result = await fetchLeaveRequests("2026-03-01", "2026-03-31");

      expect(result).toHaveLength(2);
      expect(result.map((r: { id: number }) => r.id)).toEqual([1, 3]);
    });

    it("defaults to approved state", async () => {
      const { fetchLeaveRequests } = await import("../client");
      mockPaginatedResponse([[]]);

      await fetchLeaveRequests("2026-03-01", "2026-03-31");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("state=approved"),
        expect.anything()
      );
    });

    it("supports leave type filter", async () => {
      const { fetchLeaveRequests } = await import("../client");
      mockPaginatedResponse([[]]);

      await fetchLeaveRequests("2026-03-01", "2026-03-31", { leaveTypeId: 14102 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("leave_type_id=14102"),
        expect.anything()
      );
    });
  });

  describe("fetchLeaveBalances", () => {
    it("returns balances for an employee", async () => {
      const { fetchLeaveBalances } = await import("../client");
      const balances = [
        { id: 1, balance: 10, leave_type: { id: 14102, name: "Sick Leave", unit: "days" } },
        { id: 2, balance: -448, leave_type: { id: 14618, name: "Medical", unit: "hours" } },
      ];
      mockFetchResponse({ data: balances });

      const result = await fetchLeaveBalances(12345);

      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe(10);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/employees/12345/leave_balances"),
        expect.anything()
      );
    });

    it("returns empty array on error", async () => {
      const { fetchLeaveBalances } = await import("../client");
      mockFetchResponse({}, false, 404);
      vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await fetchLeaveBalances(99999);
      expect(result).toEqual([]);
    });
  });

  describe("isConfigured", () => {
    it("returns true when API key is set", async () => {
      const { isConfigured } = await import("../client");
      expect(isConfigured()).toBe(true);
    });

    it("returns false when API key is missing", async () => {
      delete process.env.PEOPLEFORCE_API_KEY;
      vi.resetModules();
      const { isConfigured } = await import("../client");
      expect(isConfigured()).toBe(false);
    });
  });
});
