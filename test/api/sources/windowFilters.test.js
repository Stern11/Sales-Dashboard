import { describe, it, expect } from "vitest";
import { windowFilters } from "../../../api/sources/index.js";

describe("windowFilters", () => {
  it("is unfiltered for lifetime", () => {
    expect(windowFilters("lifetime")).toEqual([]);
  });

  // Calendar-aligned (the 1st of the month; the Monday of the week) in UTC,
  // not a trailing 30/7-day window — "Monthly" on Aug 2 must mean just Aug
  // 1-2, not reaching back into July.
  it("monthly starts at midnight UTC on the 1st of the current month", () => {
    const [filter] = windowFilters("monthly");
    expect(filter.propertyName).toBe("createdate");
    expect(filter.operator).toBe("GTE");
    const now = new Date();
    const start = new Date(Number(filter.value));
    expect([start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours()])
      .toEqual([now.getUTCFullYear(), now.getUTCMonth(), 1, 0]);
  });

  it("weekly starts at midnight UTC on the Monday of the current week", () => {
    const [filter] = windowFilters("weekly");
    const start = new Date(Number(filter.value));
    expect(start.getUTCDay()).toBe(1); // Monday
    expect(start.getUTCHours()).toBe(0);
    expect(start.getTime()).toBeLessThanOrEqual(Date.now());
    const daysSince = (Date.now() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysSince).toBeLessThan(7);
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
