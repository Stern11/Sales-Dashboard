import { describe, it, expect } from "vitest";
import { summarize } from "../../../lib/demo-calls/queries.js";

// `outcomes` is the ordered list of each logged call's outcome (call #1
// first) — call_count/completed_count and first/second/third_call_outcome
// are all derived from it, same as the real lateral join in queries.js.
function lead({ status = "active", outcomes = [], no_show_count = 0, pipeline_lead_id = null, company_scale = null } = {}) {
  return {
    status,
    call_count: outcomes.length,
    completed_count: outcomes.filter((o) => o === "completed").length,
    no_show_count,
    first_call_outcome: outcomes[0] ?? null,
    second_call_outcome: outcomes[1] ?? null,
    third_call_outcome: outcomes[2] ?? null,
    pipeline_lead_id,
    company_scale,
  };
}

describe("summarize", () => {
  it("all zero on an empty list", () => {
    const s = summarize([]);
    expect(s).toEqual({
      total: 0, awaiting_first_call: 0, call_1_done: 0, call_2_done: 0, call_3_done: 0,
      no_shows: 0, added_to_pipeline: 0, irrelevant: 0,
      by_scale: { startup: 0, smb: 0, mid_market: 0, enterprise: 0, unspecified: 0 },
    });
  });

  it("buckets leads by company_scale, with unset scale counted as unspecified", () => {
    const s = summarize([
      lead({ company_scale: "mid_market" }),
      lead({ company_scale: "enterprise" }),
      lead({ company_scale: "enterprise" }),
      lead({ company_scale: null }),
    ]);
    expect(s.by_scale).toEqual({ startup: 0, smb: 0, mid_market: 1, enterprise: 2, unspecified: 1 });
  });

  it("counts leads awaiting their first call vs. leads with calls completed at each position", () => {
    const s = summarize([
      lead({ outcomes: [] }),
      lead({ outcomes: ["completed"] }),
      lead({ outcomes: ["completed", "completed", "completed"] }),
    ]);
    expect(s.total).toBe(3);
    expect(s.awaiting_first_call).toBe(1);
    expect(s.call_1_done).toBe(2);
    expect(s.call_2_done).toBe(1);
    expect(s.call_3_done).toBe(1);
  });

  it("call_1_done means call #1 itself was completed — a no-show on call 1 followed by a completed call 2 counts toward call_2_done, never call_1_done", () => {
    const s = summarize([lead({ outcomes: ["no_show", "completed"] })]);
    expect(s.call_1_done).toBe(0);
    expect(s.call_2_done).toBe(1);
  });

  it("excludes irrelevant leads from the active-funnel counts but still counts them in total/irrelevant", () => {
    const s = summarize([
      lead({ status: "active", outcomes: ["completed", "completed"] }),
      lead({ status: "irrelevant", outcomes: ["completed", "completed"] }),
    ]);
    expect(s.total).toBe(2);
    expect(s.call_2_done).toBe(1);
    expect(s.irrelevant).toBe(1);
  });

  it("sums no_show_count across every lead, regardless of status", () => {
    const s = summarize([lead({ no_show_count: 1 }), lead({ no_show_count: 2 }), lead({ status: "irrelevant", no_show_count: 1 })]);
    expect(s.no_shows).toBe(4);
  });

  it("counts leads with a pipeline_lead_id as added_to_pipeline", () => {
    const s = summarize([lead({ pipeline_lead_id: "p1" }), lead({ pipeline_lead_id: null })]);
    expect(s.added_to_pipeline).toBe(1);
  });

  it("treats a string-typed no_show_count (as Neon returns) correctly, not as NaN", () => {
    const s = summarize([lead({ outcomes: ["completed", "completed"], no_show_count: "1" })]);
    expect(s.call_2_done).toBe(1);
    expect(s.no_shows).toBe(1);
  });
});
