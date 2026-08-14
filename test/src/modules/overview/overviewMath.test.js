import { describe, it, expect } from "vitest";
import { buildMonthlyOverview, monthLabel, MIN_TREND_MONTH_START } from "../../../../src/modules/overview/overviewMath.js";

// These tests probe the underlying grow/cap/roll logic on its own, so most
// pass a floor far in the past (rather than the real MIN_TREND_MONTH_START
// default) — otherwise, once "now" is on/after that temporary
// business-specific floor, it would start clamping these fixtures' dates and
// the tests would stop testing what they say they test. See the dedicated
// MIN_TREND_MONTH_START tests below for the floor itself. Fixed "now" isn't
// used (buildMonthlyOverview reads the real Date() internally, same as
// weeklyFunnelTrend()) — expectations are expressed relative to real "now"
// via this helper so the suite is correct regardless of which calendar
// month it happens to run in.
const NO_FLOOR = "2000-01";

function isoMonthsAgo(n) {
  const now = new Date();
  const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - n;
  const year = Math.floor(total / 12);
  const month = total % 12;
  return new Date(Date.UTC(year, month, 15)).toISOString(); // mid-month, unambiguous
}

function demoCallLead(bookedIso) {
  return { created_at: bookedIso, first_call_date: null };
}

function pipelineLead({ created_at = null, won_at = null, deal_size = 0 } = {}) {
  return { created_at, won_at, deal_size };
}

describe("monthLabel", () => {
  it("formats a month key as 'Mon YYYY'", () => {
    expect(monthLabel("2026-07")).toBe("Jul 2026");
    expect(monthLabel("2025-12")).toBe("Dec 2025");
  });
});

describe("buildMonthlyOverview", () => {
  it("with no data at all, shows a single bucket for just the current month, all zero", () => {
    const buckets = buildMonthlyOverview([], [], 12, NO_FLOOR);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({ meetingsBooked: 0, opportunities: 0, pipelineAdded: 0, closedWon: 0 });
  });

  it("grows one bucket per month of history instead of a fixed count, always ending on the current month", () => {
    const buckets = buildMonthlyOverview([], [demoCallLead(isoMonthsAgo(2))], 12, NO_FLOOR);
    expect(buckets).toHaveLength(3); // 2 months ago, 1 month ago, current
    const keys = buckets.map((b) => b.key);
    expect([...keys].sort()).toEqual(keys); // chronological order
  });

  it("caps the window at maxMonths and rolls forward once history exceeds it", () => {
    const buckets = buildMonthlyOverview([], [demoCallLead(isoMonthsAgo(20))], 12, NO_FLOOR);
    expect(buckets).toHaveLength(12);
  });

  it("counts meetings booked into the month matching bookedDateOf() (first_call_date, falling back to created_at)", () => {
    const buckets = buildMonthlyOverview([], [
      demoCallLead(isoMonthsAgo(1)),
      demoCallLead(isoMonthsAgo(0)),
      demoCallLead(isoMonthsAgo(0)),
    ], 12, NO_FLOOR);
    const [prev, current] = buckets;
    expect(prev.meetingsBooked).toBe(1);
    expect(current.meetingsBooked).toBe(2);
  });

  it("counts opportunities and sums pipelineAdded by created_at, independent of won_at", () => {
    const buckets = buildMonthlyOverview([
      pipelineLead({ created_at: isoMonthsAgo(0), deal_size: 1000 }),
      pipelineLead({ created_at: isoMonthsAgo(0), deal_size: 2000 }),
    ], [], 12, NO_FLOOR);
    expect(buckets[0].opportunities).toBe(2);
    expect(buckets[0].pipelineAdded).toBe(3000);
  });

  it("buckets closedWon by won_at, not created_at — a lead created one month and won a later month lands its value in the month it actually won", () => {
    const buckets = buildMonthlyOverview([
      pipelineLead({ created_at: isoMonthsAgo(1), won_at: isoMonthsAgo(0), deal_size: 5000 }),
    ], [], 12, NO_FLOOR);
    const [prev, current] = buckets;
    expect(prev.opportunities).toBe(1); // created here
    expect(prev.closedWon).toBe(0);     // not won here
    expect(current.opportunities).toBe(0);
    expect(current.closedWon).toBe(5000); // won here
  });

  it("a lead with no won_at contributes nothing to closedWon in any month", () => {
    const buckets = buildMonthlyOverview([pipelineLead({ created_at: isoMonthsAgo(0), deal_size: 9000 })], [], 12, NO_FLOOR);
    expect(buckets.reduce((sum, b) => sum + b.closedWon, 0)).toBe(0);
  });

  it("silently drops activity from before the visible window once the window is capped, instead of throwing", () => {
    const buckets = buildMonthlyOverview([], [demoCallLead(isoMonthsAgo(50))], 4, NO_FLOOR);
    expect(buckets).toHaveLength(4);
    expect(buckets.reduce((sum, b) => sum + b.meetingsBooked, 0)).toBe(0);
  });

  it("a lead with no usable date is skipped rather than crashing", () => {
    expect(() => buildMonthlyOverview([pipelineLead({})], [demoCallLead(null)], 12, NO_FLOOR)).not.toThrow();
  });

  describe("MIN_TREND_MONTH_START floor (default, no override)", () => {
    it("never starts before the floor even when a lead is booked much earlier", () => {
      const buckets = buildMonthlyOverview([], [demoCallLead("2000-01-01T00:00:00Z")], 12);
      expect(buckets[0].key).toBe(MIN_TREND_MONTH_START);
      // The year-2000 lead itself still falls outside the (floored) window and is dropped.
      expect(buckets.reduce((sum, b) => sum + b.meetingsBooked, 0)).toBe(0);
    });

    it("starts at a real recent lead's own month when that's later than the floor", () => {
      const buckets = buildMonthlyOverview([], [demoCallLead(new Date().toISOString())], 12);
      const floorTime = new Date(`${MIN_TREND_MONTH_START}-01T00:00:00Z`).getTime();
      const firstBucketTime = new Date(`${buckets[0].key}-01T00:00:00Z`).getTime();
      expect(firstBucketTime).toBeGreaterThanOrEqual(floorTime);
    });
  });
});
