import { describe, it, expect } from "vitest";
import {
  BOOKED_PERIOD_OPTIONS, resolvePeriodRange, isWithinRange,
  OUTCOME_OPTIONS, outcomeMeta, STATUS_OPTIONS, statusMeta, effectiveStatus, summarizeLeads,
  FUNNEL_TREND_SERIES, weeklyFunnelTrend, bookedDateOf, MIN_TREND_WEEK_START,
  COMPANY_SCALE_OPTIONS, scaleLabel,
} from "../../../../src/modules/demo-calls/constants.js";
import { summarize as serverSummarize } from "../../../../lib/demo-calls/queries.js";

describe("resolvePeriodRange", () => {
  it("'all' is fully unbounded", () => {
    expect(resolvePeriodRange("all")).toEqual({ from: null, to: null });
  });

  it("an unrecognized value falls back to unbounded, same as 'all'", () => {
    expect(resolvePeriodRange("bogus")).toEqual({ from: null, to: null });
  });

  it("'week' is a rolling 7-day window ending now (unbounded upper end)", () => {
    const { from, to } = resolvePeriodRange("week");
    expect(to).toBeNull();
    const days = (Date.now() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(7, 1);
  });

  it("'month' is a rolling 30-day window ending now", () => {
    const { from, to } = resolvePeriodRange("month");
    expect(to).toBeNull();
    const days = (Date.now() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(30, 1);
  });

  it("'custom' parses both bounds (in local time — a date input has no timezone of its own), 'to' inclusive of the whole day", () => {
    const { from, to } = resolvePeriodRange("custom", "2026-08-01", "2026-08-07");
    expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()]).toEqual([2026, 7, 1, 0]);
    expect([to.getFullYear(), to.getMonth(), to.getDate(), to.getHours(), to.getMinutes()]).toEqual([2026, 7, 7, 23, 59]);
  });

  it("'custom' with only one bound leaves the other unbounded", () => {
    expect(resolvePeriodRange("custom", "2026-08-01", "")).toEqual({
      from: new Date("2026-08-01T00:00:00"), to: null,
    });
    expect(resolvePeriodRange("custom", "", "2026-08-07")).toMatchObject({ from: null });
  });
});

describe("isWithinRange", () => {
  const from = new Date("2026-08-01T00:00:00");
  const to = new Date("2026-08-07T23:59:59.999");

  it("true when inside both bounds", () => {
    expect(isWithinRange("2026-08-03T12:00:00Z", from, to)).toBe(true);
  });
  it("false when before the lower bound", () => {
    expect(isWithinRange("2026-07-31T23:00:00", from, to)).toBe(false);
  });
  it("false when after the upper bound", () => {
    expect(isWithinRange("2026-08-08T00:00:01", from, to)).toBe(false);
  });
  it("true with no bounds at all", () => {
    expect(isWithinRange("2020-01-01T00:00:00Z", null, null)).toBe(true);
  });
  it("false for a missing timestamp", () => {
    expect(isWithinRange(null, from, to)).toBe(false);
    expect(isWithinRange(undefined, null, null)).toBe(false);
  });
});

describe("BOOKED_PERIOD_OPTIONS", () => {
  it("includes exactly week/month/all/custom", () => {
    expect(BOOKED_PERIOD_OPTIONS.map((o) => o.value)).toEqual(["week", "month", "all", "custom"]);
  });
});

describe("outcomeMeta / statusMeta", () => {
  it("returns the matching option for every known value", () => {
    for (const o of OUTCOME_OPTIONS) expect(outcomeMeta(o.value)).toBe(o);
    for (const s of STATUS_OPTIONS) expect(statusMeta(s.value)).toBe(s);
  });
  it("falls back to a generic shape for an unknown value instead of throwing", () => {
    expect(outcomeMeta("bogus").label).toBe("bogus");
    expect(statusMeta("bogus").label).toBe("bogus");
  });
});

describe("effectiveStatus", () => {
  it("is 'active' when nothing overrides it", () => {
    expect(effectiveStatus("active", null)).toBe("active");
    expect(effectiveStatus("active", "completed")).toBe("active");
  });
  it("is 'no_show' when the most recent call was a no-show", () => {
    expect(effectiveStatus("active", "no_show")).toBe("no_show");
  });
  it("'irrelevant' always wins, even over a no-show last call", () => {
    expect(effectiveStatus("irrelevant", "no_show")).toBe("irrelevant");
    expect(effectiveStatus("irrelevant", "completed")).toBe("irrelevant");
  });
});

describe("summarizeLeads", () => {
  it("matches the server's summarize() for the same input — hand-mirrored with no shared source", () => {
    const leads = [
      { status: "active", call_count: 2, completed_count: 1, no_show_count: 1, pipeline_lead_id: null, company_scale: "enterprise" },
      { status: "active", call_count: 0, completed_count: 0, no_show_count: 0, pipeline_lead_id: "p1", company_scale: "mid_market" },
      { status: "irrelevant", call_count: 1, completed_count: 1, no_show_count: 0, pipeline_lead_id: null, company_scale: null },
    ];
    expect(summarizeLeads(leads)).toEqual(serverSummarize(leads));
  });

  it("call_1_done/call_2_done read completed_count, not call_count — a no-show attempt isn't 'done'", () => {
    const leads = [
      // call_count 1 but nothing completed — a no-show, not a done call.
      { status: "active", call_count: 1, completed_count: 0, no_show_count: 1, pipeline_lead_id: null, company_scale: null },
      // call_count 2 (a no-show retried), only the retry completed.
      { status: "active", call_count: 2, completed_count: 1, no_show_count: 1, pipeline_lead_id: null, company_scale: null },
    ];
    const s = summarizeLeads(leads);
    expect(s.call_1_done).toBe(1);
    expect(s.call_2_done).toBe(0);
  });

  it("counts mid_market and enterprise leads for the KPI card, independent of status", () => {
    const s = summarizeLeads([
      { status: "active", company_scale: "mid_market" },
      { status: "irrelevant", company_scale: "enterprise" },
      { status: "active", company_scale: "startup" },
    ]);
    expect(s.by_scale.mid_market).toBe(1);
    expect(s.by_scale.enterprise).toBe(1);
    expect(s.by_scale.startup).toBe(1);
  });
});

describe("COMPANY_SCALE_OPTIONS / scaleLabel", () => {
  it("returns the matching label for every known value", () => {
    for (const o of COMPANY_SCALE_OPTIONS) expect(scaleLabel(o.value)).toBe(o.label);
  });
  it("falls back to an em-dash for an unset/unknown value", () => {
    expect(scaleLabel(null)).toBe("—");
    expect(scaleLabel("bogus")).toBe("—");
  });
});

describe("bookedDateOf", () => {
  it("prefers first_call_date over created_at when a call's been logged", () => {
    const lead = { first_call_date: "2026-03-18", created_at: "2026-08-09T06:22:10.546Z" };
    expect(bookedDateOf(lead)).toBe("2026-03-18T00:00:00");
  });
  it("falls back to created_at when no call's been logged yet", () => {
    const lead = { first_call_date: null, created_at: "2026-08-09T06:22:10.546Z" };
    expect(bookedDateOf(lead)).toBe("2026-08-09T06:22:10.546Z");
  });
});

describe("weeklyFunnelTrend", () => {
  function weeksAgoIso(n) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n * 7);
    return d.toISOString();
  }

  // These tests probe the underlying grow/cap/roll logic on its own, so they
  // pass a floor far in the past (rather than the real MIN_TREND_WEEK_START
  // default) — otherwise, once "now" is close enough to that temporary
  // business-specific floor, it would start clamping these fixtures' dates
  // and the tests would stop testing what they say they test. See the
  // dedicated MIN_TREND_WEEK_START tests below for the floor itself.
  const NO_FLOOR = "2000-01-01";

  it("buckets a backfilled lead by its first_call_date, not the created_at row-insert time — the bug this was built to fix: a lead imported long after its real meeting would otherwise pile into whatever week it was entered", () => {
    const buckets = weeklyFunnelTrend([
      // Inserted into the DB "now" (e.g. a bulk import), but the real
      // meeting was 5 weeks ago per the call log.
      { created_at: new Date().toISOString(), first_call_date: weeksAgoIso(5).slice(0, 10), call_count: 1, status: "active", pipeline_lead_id: null },
    ], 8, NO_FLOOR);
    expect(buckets).toHaveLength(6); // 5 weeks ago through the current week
    expect(buckets[0].booked).toBe(1);
    expect(buckets.slice(1).reduce((sum, b) => sum + b.booked, 0)).toBe(0);
  });

  it("with no leads booked yet, shows a single bucket for just the current week", () => {
    const buckets = weeklyFunnelTrend([], 8, NO_FLOOR);
    expect(buckets).toHaveLength(1);
  });

  it("grows one bucket per week of history instead of a fixed count, always ending on the current week", () => {
    const buckets = weeklyFunnelTrend(
      [{ created_at: weeksAgoIso(2), call_count: 0, status: "active", pipeline_lead_id: null }],
      8, NO_FLOOR
    );
    expect(buckets).toHaveLength(3); // 2 weeks ago, 1 week ago, current week
    const starts = buckets.map((b) => b.week_start);
    expect([...starts].sort()).toEqual(starts);
    const lastMonday = new Date(buckets[buckets.length - 1].week_start + "T00:00:00Z");
    const diffDays = (Date.now() - lastMonday.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeLessThan(7);
    expect(diffDays).toBeGreaterThanOrEqual(0);
  });

  it("caps the window at maxWeeks and rolls forward once history exceeds it, still ending on the current week", () => {
    const buckets = weeklyFunnelTrend(
      [{ created_at: weeksAgoIso(20), call_count: 0, status: "active", pipeline_lead_id: null }],
      8, NO_FLOOR
    );
    expect(buckets).toHaveLength(8);
    const lastMonday = new Date(buckets[7].week_start + "T00:00:00Z");
    const diffDays = (Date.now() - lastMonday.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeLessThan(7);
    expect(diffDays).toBeGreaterThanOrEqual(0);
  });

  it("counts a lead created now into the current (last) bucket as booked", () => {
    const buckets = weeklyFunnelTrend([
      { created_at: weeksAgoIso(3), call_count: 0, status: "active", pipeline_lead_id: null },
      { created_at: new Date().toISOString(), call_count: 0, status: "active", pipeline_lead_id: null },
    ], 8, NO_FLOOR);
    expect(buckets[buckets.length - 1].booked).toBe(1);
    expect(buckets.slice(0, -1).reduce((sum, b) => sum + b.booked, 0)).toBe(1);
  });

  describe("MIN_TREND_WEEK_START floor (default, no override)", () => {
    it("never starts before the floor even when a lead is booked much earlier", () => {
      const buckets = weeklyFunnelTrend(
        [{ created_at: "2000-01-01T00:00:00Z", call_count: 0, status: "active", pipeline_lead_id: null }],
        8
      );
      expect(buckets[0].week_start).toBe(MIN_TREND_WEEK_START);
      // The 2000-01-01 lead itself still falls outside the (floored) window and is dropped.
      expect(buckets.reduce((sum, b) => sum + b.booked, 0)).toBe(0);
    });

    it("starts at a real recent lead's own week when that's later than the floor", () => {
      const buckets = weeklyFunnelTrend(
        [{ created_at: new Date().toISOString(), call_count: 0, status: "active", pipeline_lead_id: null }],
        8
      );
      const floorTime = new Date(MIN_TREND_WEEK_START + "T00:00:00Z").getTime();
      const firstBucketTime = new Date(buckets[0].week_start + "T00:00:00Z").getTime();
      expect(firstBucketTime).toBeGreaterThanOrEqual(floorTime);
    });
  });

  it("completed_count thresholds feed call_1_done/call_2_done independently — a logged no-show doesn't count as done", () => {
    const now = new Date().toISOString();
    const [bucket] = weeklyFunnelTrend([
      { created_at: now, call_count: 1, completed_count: 0, status: "active", pipeline_lead_id: null },
      { created_at: now, call_count: 1, completed_count: 1, status: "active", pipeline_lead_id: null },
      { created_at: now, call_count: 2, completed_count: 2, status: "active", pipeline_lead_id: null },
    ], 8);
    expect(bucket.booked).toBe(3);
    expect(bucket.call_1_done).toBe(2);
    expect(bucket.call_2_done).toBe(1);
  });

  it("counts pipeline_lead_id and status:irrelevant independently of call progress", () => {
    const now = new Date().toISOString();
    const [bucket] = weeklyFunnelTrend([
      { created_at: now, completed_count: 0, status: "active", pipeline_lead_id: "p1" },
      { created_at: now, completed_count: 0, status: "irrelevant", pipeline_lead_id: null },
    ], 8);
    expect(bucket.added_to_pipeline).toBe(1);
    expect(bucket.irrelevant).toBe(1);
  });

  it("excludes irrelevant leads from call_1_done/call_2_done — matches summarizeLeads' semantics, which also only counts active leads toward call progress", () => {
    const now = new Date().toISOString();
    const [bucket] = weeklyFunnelTrend([
      { created_at: now, completed_count: 2, status: "irrelevant", pipeline_lead_id: null },
      { created_at: now, completed_count: 1, status: "active", pipeline_lead_id: null },
    ], 8);
    expect(bucket.booked).toBe(2);
    expect(bucket.call_1_done).toBe(1);
    expect(bucket.call_2_done).toBe(0);
    expect(bucket.irrelevant).toBe(1);
  });

  it("silently drops leads booked before the visible window once the window is capped, instead of throwing", () => {
    const buckets = weeklyFunnelTrend([{ created_at: "2000-01-01T00:00:00Z", call_count: 0, status: "active", pipeline_lead_id: null }], 4, NO_FLOOR);
    expect(buckets).toHaveLength(4);
    expect(buckets.reduce((sum, b) => sum + b.booked, 0)).toBe(0);
  });

  it("skips a lead with no created_at rather than crashing", () => {
    expect(() => weeklyFunnelTrend([{ created_at: null }], 4)).not.toThrow();
  });
});

describe("FUNNEL_TREND_SERIES", () => {
  it("has exactly the 3 charted series in a fixed order", () => {
    expect(FUNNEL_TREND_SERIES.map((s) => s.key)).toEqual([
      "booked", "call_1_done", "added_to_pipeline",
    ]);
  });
});
