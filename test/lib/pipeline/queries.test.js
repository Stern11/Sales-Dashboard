import { describe, it, expect } from "vitest";
import { summarize } from "../../../lib/pipeline/queries.js";

function lead(stage, deal_size) {
  return { stage, deal_size };
}

describe("summarize", () => {
  it("counts total and per-stage on an empty list", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.open_pipeline_value).toBe(0);
    expect(s.by_stage).toEqual({ sql: 0, discovery: 0, proposal: 0, commercial: 0, won: 0, cold: 0, lost: 0 });
  });

  it("counts leads per stage", () => {
    const s = summarize([lead("sql"), lead("sql"), lead("won"), lead("lost")]);
    expect(s.total).toBe(4);
    expect(s.by_stage.sql).toBe(2);
    expect(s.by_stage.won).toBe(1);
    expect(s.by_stage.lost).toBe(1);
  });

  it("sums deal_size only for active stages (sql..won), excluding cold/lost", () => {
    const s = summarize([
      lead("sql", "10000.00"),      // active — Neon returns numeric as a string
      lead("discovery", 5000),
      lead("won", 20000),
      lead("cold", 99999),          // must NOT count
      lead("lost", 99999),          // must NOT count
    ]);
    expect(s.open_pipeline_value).toBe(35000);
  });

  it("sums closed_won_value only for won-stage leads — a subset of open_pipeline_value, which (per the test above) already includes won alongside sql..commercial", () => {
    const s = summarize([lead("won", 4000), lead("won", 6000), lead("sql", 999), lead("cold", 999)]);
    expect(s.closed_won_value).toBe(10000);
    expect(s.open_pipeline_value).toBe(10999); // won (10000) + sql (999), cold excluded
  });

  it("treats missing/null deal_size as 0, not NaN", () => {
    const s = summarize([lead("sql", null), lead("sql", undefined), lead("sql")]);
    expect(s.open_pipeline_value).toBe(0);
    expect(Number.isNaN(s.open_pipeline_value)).toBe(false);
  });

  it("ignores a non-numeric deal_size instead of poisoning the total with NaN", () => {
    const s = summarize([lead("sql", "not-a-number"), lead("sql", 5000)]);
    expect(s.open_pipeline_value).toBe(5000);
  });
});
