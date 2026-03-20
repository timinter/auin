import type { Entity } from "@/types";

/**
 * Business rule: freelancers can only be assigned to US or CRYPTO entities.
 * This mirrors the filter in admin/users/[id]/page.tsx
 */
function getAvailableEntities(role: string): Entity[] {
  const allEntities: Entity[] = ["BY", "US", "CRYPTO"];
  if (role === "freelancer") {
    return allEntities.filter((e) => e !== "BY");
  }
  return allEntities;
}

/**
 * Client-side project search filter.
 * Mirrors the filter in admin/projects/page.tsx
 */
function filterProjects<T extends { name: string }>(projects: T[], search: string): T[] {
  if (!search) return projects;
  return projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
}

describe("Entity restriction rules", () => {
  it("employees can access all entities", () => {
    expect(getAvailableEntities("employee")).toEqual(["BY", "US", "CRYPTO"]);
  });

  it("admins can access all entities", () => {
    expect(getAvailableEntities("admin")).toEqual(["BY", "US", "CRYPTO"]);
  });

  it("freelancers cannot access BY entity", () => {
    const entities = getAvailableEntities("freelancer");
    expect(entities).toEqual(["US", "CRYPTO"]);
    expect(entities).not.toContain("BY");
  });
});

describe("Project search filter", () => {
  const projects = [
    { name: "AI Chatbot" },
    { name: "Backend API v2" },
    { name: "CRM System" },
    { name: "Data Pipeline" },
  ];

  it("returns all projects when search is empty", () => {
    expect(filterProjects(projects, "")).toEqual(projects);
  });

  it("filters by partial name match (case-insensitive)", () => {
    expect(filterProjects(projects, "api")).toEqual([{ name: "Backend API v2" }]);
  });

  it("filters by multiple matches", () => {
    const result = filterProjects(projects, "a");
    expect(result).toEqual([
      { name: "AI Chatbot" },
      { name: "Backend API v2" },
      { name: "Data Pipeline" },
    ]);
  });

  it("returns empty array when no match", () => {
    expect(filterProjects(projects, "xyz")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(filterProjects(projects, "CRM")).toEqual([{ name: "CRM System" }]);
    expect(filterProjects(projects, "crm")).toEqual([{ name: "CRM System" }]);
  });
});
