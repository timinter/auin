import { describe, it, expect } from "vitest";
import { mapLocationToEntity, mapStatus } from "../sync";

describe("PeopleForce Sync Helpers", () => {
  describe("mapLocationToEntity", () => {
    it("maps Belarus to BY", () => {
      expect(mapLocationToEntity("Belarus")).toBe("BY");
    });

    it("maps case-insensitive", () => {
      expect(mapLocationToEntity("BELARUS")).toBe("BY");
      expect(mapLocationToEntity("belarus")).toBe("BY");
    });

    it("maps United States to US", () => {
      expect(mapLocationToEntity("United States")).toBe("US");
    });

    it("returns null for unknown locations", () => {
      expect(mapLocationToEntity("Germany")).toBeNull();
      expect(mapLocationToEntity("")).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(mapLocationToEntity(undefined)).toBeNull();
    });
  });

  describe("mapStatus", () => {
    it("maps employed to active", () => {
      expect(mapStatus("employed")).toBe("active");
    });

    it("maps probation to active", () => {
      expect(mapStatus("probation")).toBe("active");
    });

    it("maps terminated to inactive", () => {
      expect(mapStatus("terminated")).toBe("inactive");
    });

    it("maps dismissed to inactive", () => {
      expect(mapStatus("dismissed")).toBe("inactive");
    });

    it("handles case-insensitive", () => {
      expect(mapStatus("Employed")).toBe("active");
      expect(mapStatus("TERMINATED")).toBe("inactive");
    });

    it("returns null for unknown status", () => {
      expect(mapStatus("on_leave")).toBeNull();
      expect(mapStatus("")).toBeNull();
    });

    it("returns null for undefined", () => {
      expect(mapStatus(undefined)).toBeNull();
    });
  });
});
