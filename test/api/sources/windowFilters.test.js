import { describe, it, expect } from "vitest";
import { windowFilters } from "../../../api/sources/index.js";

describe("windowFilters", () => {
  it("is unfiltered for lifetime", () => {
    expect(windowFilters("lifetime")).toEqual([]);
  });

  it("monthly is a rolling ~30-day GTE filter", () => {
    const [filter] = windowFilters("monthly");
    expect(filter.propertyName).toBe("createdate");
    expect(filter.operator).toBe("GTE");
    const days = (Date.now() - Number(filter.value)) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(30, 0);
  });

  it("weekly is a rolling ~7-day GTE filter", () => {
    const [filter] = windowFilters("weekly");
    const days = (Date.now() - Number(filter.value)) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(7, 0);
  });

  describe("custom", () => {
    // Parsed in the server's local time (same as resolvePeriodRange's own
    // 'custom' handling in src/modules/demo-calls/constants.js) — asserted
    // via local date/time components rather than a fixed UTC string, which
    // would only hold in a UTC-timezone test environment.
    it("builds a GTE/LTE pair from well-formed from/to dates, 'to' inclusive of the whole day", () => {
      const filters = windowFilters("custom", "2026-08-01", "2026-08-07");
      expect(filters).toHaveLength(2);
      const gte = new Date(Number(filters.find((f) => f.operator === "GTE").value));
      const lte = new Date(Number(filters.find((f) => f.operator === "LTE").value));
      expect([gte.getFullYear(), gte.getMonth(), gte.getDate(), gte.getHours(), gte.getMinutes()]).toEqual([2026, 7, 1, 0, 0]);
      expect([lte.getFullYear(), lte.getMonth(), lte.getDate(), lte.getHours(), lte.getMinutes()]).toEqual([2026, 7, 7, 23, 59]);
    });

    it("with only one bound, builds only that one filter — an open-ended range", () => {
      expect(windowFilters("custom", "2026-08-01", undefined)).toHaveLength(1);
      expect(windowFilters("custom", undefined, "2026-08-07")).toHaveLength(1);
    });

    it("with no bounds at all, is unfiltered — same as lifetime", () => {
      expect(windowFilters("custom", undefined, undefined)).toEqual([]);
    });

    // A malformed date must not reach HubSpot's filter API, which would
    // reject the whole request over one bad query param rather than just
    // ignoring it.
    it("ignores a malformed date instead of building a broken filter", () => {
      expect(windowFilters("custom", "not-a-date", "2026-08-07")).toHaveLength(1);
      expect(windowFilters("custom", "2026/08/01", "2026-08-07")).toHaveLength(1);
      expect(windowFilters("custom", "'; DROP TABLE contacts; --", "2026-08-07")).toHaveLength(1);
    });
  });
});
