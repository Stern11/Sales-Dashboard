import { describe, it, expect } from "vitest";
import {
  STAGES, ACTIVE_STAGES, stageMeta, summarizeLeads,
  PRIORITY_OPTIONS, priorityMeta,
  regionBucket, REGION_CATEGORIES, REGION_OTHER, REGION_UNSPECIFIED,
  relativeTime, currency,
} from "../../../../src/modules/pipeline/constants.js";
import { summarize as serverSummarize } from "../../../../lib/pipeline/queries.js";

describe("stageMeta", () => {
  it("returns the matching stage for every known value", () => {
    for (const s of STAGES) expect(stageMeta(s.value)).toBe(s);
  });
  it("falls back to a generic stage shape for an unknown value instead of throwing", () => {
    const m = stageMeta("bogus");
    expect(m.label).toBe("bogus");
    expect(m.pillVariant).toBe("stage");
  });
});

describe("priorityMeta", () => {
  it("returns the matching priority for every known value", () => {
    for (const p of PRIORITY_OPTIONS) expect(priorityMeta(p.value)).toBe(p);
  });
  it("defaults to medium for an unknown/undefined value", () => {
    expect(priorityMeta(undefined)).toBe(PRIORITY_OPTIONS[1]);
    expect(priorityMeta("bogus")).toBe(PRIORITY_OPTIONS[1]);
  });
});

describe("regionBucket", () => {
  it("passes through a fixed category as-is", () => {
    for (const r of REGION_CATEGORIES) expect(regionBucket(r)).toBe(r);
  });
  it("buckets any custom free-text region into REGION_OTHER", () => {
    expect(regionBucket("LATAM")).toBe(REGION_OTHER);
    expect(regionBucket("Mars Colony")).toBe(REGION_OTHER);
  });
  it("buckets null/empty region into REGION_UNSPECIFIED", () => {
    expect(regionBucket(null)).toBe(REGION_UNSPECIFIED);
    expect(regionBucket("")).toBe(REGION_UNSPECIFIED);
    expect(regionBucket(undefined)).toBe(REGION_UNSPECIFIED);
  });
});

describe("summarizeLeads", () => {
  it("matches the server's summarize() for the same input — the two are hand-mirrored with no shared source, so a drift here would silently make the dashboard's KPI row disagree with the DB's own totals", () => {
    const leads = [
      { stage: "sql", deal_size: "10000.00" },
      { stage: "discovery", deal_size: 5000 },
      { stage: "won", deal_size: 20000 },
      { stage: "cold", deal_size: 99999 },
      { stage: "lost", deal_size: 99999 },
    ];
    expect(summarizeLeads(leads)).toEqual(serverSummarize(leads));
  });

  it("sums open_pipeline_value only for active stages", () => {
    const s = summarizeLeads([{ stage: "sql", deal_size: 100 }, { stage: "cold", deal_size: 999 }]);
    expect(s.open_pipeline_value).toBe(100);
  });

  it("sums closed_won_value only for won-stage leads", () => {
    const s = summarizeLeads([{ stage: "won", deal_size: 4000 }, { stage: "won", deal_size: 6000 }, { stage: "sql", deal_size: 999 }]);
    expect(s.closed_won_value).toBe(10000);
  });
});

describe("relativeTime", () => {
  it("returns em-dash for a missing timestamp", () => {
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime(undefined)).toBe("—");
  });
  it("reports something just now for the current instant", () => {
    expect(relativeTime(new Date().toISOString())).toBe("just now");
  });
  it("reports minutes ago for a recent timestamp", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(relativeTime(fiveMinAgo)).toBe("5m ago");
  });
});

describe("currency", () => {
  it("formats with no fractional digits", () => {
    expect(currency.format(75000)).not.toContain(".");
  });
});

describe("ACTIVE_STAGES", () => {
  it("is exactly the stages flagged isActive in STAGES, in the same order", () => {
    expect(ACTIVE_STAGES).toEqual(STAGES.filter((s) => s.isActive));
  });
});
