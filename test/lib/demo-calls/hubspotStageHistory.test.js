import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchStageEnteredAt } from "../../../lib/demo-calls/hubspotStageHistory.js";

vi.mock("../../../lib/hubspot.js", async () => {
  const actual = await vi.importActual("../../../lib/hubspot.js");
  return { ...actual, hubspotGet: vi.fn() };
});

import { hubspotGet } from "../../../lib/hubspot.js";

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "marketingqualifiedlead", label: "MQL" },
  { value: "opportunity", label: "Opportunity" },
  { value: "salesqualifiedlead", label: "SQL" },
  { value: "customer", label: "Customer" },
];

beforeEach(() => vi.clearAllMocks());

describe("fetchStageEnteredAt", () => {
  it("returns the earliest history entry at or beyond the target stage", () => {
    hubspotGet.mockResolvedValue({
      propertiesWithHistory: {
        lifecyclestage: [
          // Newest-first, as HubSpot returns it.
          { value: "customer", timestamp: "2026-08-01T00:00:00.000Z" },
          { value: "salesqualifiedlead", timestamp: "2026-07-10T00:00:00.000Z" },
          { value: "opportunity", timestamp: "2026-06-29T10:00:00.000Z" },
          { value: "marketingqualifiedlead", timestamp: "2026-05-01T08:00:00.000Z" },
        ],
      },
    });
    return fetchStageEnteredAt("token", "contact-1", STAGES, "opportunity").then((result) => {
      expect(result).toBe("2026-06-29T10:00:00.000Z");
    });
  });

  it("uses the FIRST time they reached the stage, not the most recent, if they regressed and came back", async () => {
    hubspotGet.mockResolvedValue({
      propertiesWithHistory: {
        lifecyclestage: [
          { value: "opportunity", timestamp: "2026-08-01T00:00:00.000Z" }, // re-entered
          { value: "marketingqualifiedlead", timestamp: "2026-07-01T00:00:00.000Z" }, // regressed
          { value: "opportunity", timestamp: "2026-06-01T00:00:00.000Z" }, // first time
        ],
      },
    });
    const result = await fetchStageEnteredAt("token", "contact-1", STAGES, "opportunity");
    expect(result).toBe("2026-06-01T00:00:00.000Z");
  });

  it("returns null when the contact never reached the target stage", async () => {
    hubspotGet.mockResolvedValue({
      propertiesWithHistory: {
        lifecyclestage: [{ value: "marketingqualifiedlead", timestamp: "2026-05-01T00:00:00.000Z" }],
      },
    });
    expect(await fetchStageEnteredAt("token", "contact-1", STAGES, "opportunity")).toBeNull();
  });

  // A real, unremarkable case — HubSpot doesn't always retroactively record
  // a history entry for whatever value a property held at contact-creation
  // time. Callers fall back to created_at (bookedDateOf()).
  it("returns null when there's no history on file at all", async () => {
    hubspotGet.mockResolvedValue({ propertiesWithHistory: { lifecyclestage: [] } });
    expect(await fetchStageEnteredAt("token", "contact-1", STAGES, "opportunity")).toBeNull();
    hubspotGet.mockResolvedValue({});
    expect(await fetchStageEnteredAt("token", "contact-1", STAGES, "opportunity")).toBeNull();
  });

  it("returns null for an unknown target stage rather than throwing", async () => {
    expect(await fetchStageEnteredAt("token", "contact-1", STAGES, "not-a-real-stage")).toBeNull();
    expect(hubspotGet).not.toHaveBeenCalled();
  });

  it("requests property history for exactly the lifecyclestage property", async () => {
    hubspotGet.mockResolvedValue({ propertiesWithHistory: { lifecyclestage: [] } });
    await fetchStageEnteredAt("token", "contact-42", STAGES, "opportunity");
    expect(hubspotGet).toHaveBeenCalledWith(
      "token",
      expect.stringMatching(/^\/crm\/v3\/objects\/contacts\/contact-42\?.*propertiesWithHistory=lifecyclestage/)
    );
  });
});
