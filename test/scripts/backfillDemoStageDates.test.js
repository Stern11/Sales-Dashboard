import { describe, it, expect, vi, beforeEach } from "vitest";

// Captures every statement + its interpolated values, same approach as
// test/lib/demo-calls/addCall.test.js — lets assertions check what SQL
// would be sent without a real database.
const statements = [];
let selectResult = [];

function fakeSql(strings, ...values) {
  const text = strings.raw.join("?");
  statements.push({ text, values });
  if (/^\s*select/i.test(text)) return Promise.resolve(selectResult);
  return Promise.resolve([]);
}

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => fakeSql),
}));

vi.mock("../../lib/abm.js", () => ({
  getLifecycleStages: vi.fn(),
}));

vi.mock("../../lib/demo-calls/hubspotStageHistory.js", () => ({
  fetchStageEnteredAt: vi.fn(),
}));

vi.mock("../../lib/hubspot.js", () => ({
  sleep: vi.fn(() => Promise.resolve()),
}));

import { getLifecycleStages } from "../../lib/abm.js";
import { fetchStageEnteredAt } from "../../lib/demo-calls/hubspotStageHistory.js";
import { sleep } from "../../lib/hubspot.js";
import { run } from "../../scripts/backfill-demo-stage-dates.js";

const STAGES = [{ value: "opportunity", label: "Opportunity" }];

beforeEach(() => {
  vi.clearAllMocks();
  statements.length = 0;
  selectResult = [];
  process.env.DATABASE_URL = "postgres://fake";
  process.env.HUBSPOT_TOKEN = "fake-token";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("backfill-demo-stage-dates run()", () => {
  it("exits early with nothing to do when no leads are missing a date", async () => {
    selectResult = [];
    await run();
    expect(getLifecycleStages).not.toHaveBeenCalled();
  });

  it("updates each lead that has a stage-entered-at date on file", async () => {
    selectResult = [
      { id: "lead-1", company_name: "Acme", hubspot_contact_id: "111" },
      { id: "lead-2", company_name: "Globex", hubspot_contact_id: "222" },
    ];
    getLifecycleStages.mockResolvedValue(STAGES);
    fetchStageEnteredAt.mockResolvedValueOnce("2026-06-29T10:00:00.000Z").mockResolvedValueOnce("2026-07-01T00:00:00.000Z");

    await run();

    const updates = statements.filter((s) => /^update demo_call_leads/i.test(s.text));
    expect(updates).toHaveLength(2);
    expect(updates[0].values).toContain("lead-1");
    expect(updates[0].values).toContain("2026-06-29T10:00:00.000Z");
    expect(updates[1].values).toContain("lead-2");
    expect(updates[1].values).toContain("2026-07-01T00:00:00.000Z");
  });

  it("leaves a lead untouched when HubSpot has no stage history for it", async () => {
    selectResult = [{ id: "lead-1", company_name: "Acme", hubspot_contact_id: "111" }];
    getLifecycleStages.mockResolvedValue(STAGES);
    fetchStageEnteredAt.mockResolvedValue(null);

    await run();

    expect(statements.some((s) => /^update demo_call_leads/i.test(s.text))).toBe(false);
  });

  // A HubSpot failure on one lead (rate limit, transient error) must not
  // abort the whole run — the rest should still be attempted.
  it("continues past a failed lookup instead of aborting the whole run", async () => {
    selectResult = [
      { id: "lead-1", company_name: "Acme", hubspot_contact_id: "111" },
      { id: "lead-2", company_name: "Globex", hubspot_contact_id: "222" },
    ];
    getLifecycleStages.mockResolvedValue(STAGES);
    fetchStageEnteredAt.mockRejectedValueOnce(new Error("rate limited")).mockResolvedValueOnce("2026-07-01T00:00:00.000Z");

    await run();

    const updates = statements.filter((s) => /^update demo_call_leads/i.test(s.text));
    expect(updates).toHaveLength(1);
    expect(updates[0].values).toContain("lead-2");
  });

  it("only selects leads missing a date, and paces requests between lookups", async () => {
    selectResult = [
      { id: "lead-1", company_name: "Acme", hubspot_contact_id: "111" },
      { id: "lead-2", company_name: "Globex", hubspot_contact_id: "222" },
    ];
    getLifecycleStages.mockResolvedValue(STAGES);
    fetchStageEnteredAt.mockResolvedValue("2026-07-01T00:00:00.000Z");

    await run();

    const select = statements.find((s) => /^\s*select/i.test(s.text));
    expect(select.text).toMatch(/demo_stage_entered_at is null/i);
    expect(select.text).toMatch(/hubspot_contact_id is not null/i);
    // Paced between lookups (N-1 sleeps for N leads), not after the last one.
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
