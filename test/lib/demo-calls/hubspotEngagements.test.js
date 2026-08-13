import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchEngagementsForContact } from "../../../lib/demo-calls/hubspotEngagements.js";
import { HubspotScopeError } from "../../../lib/hubspot.js";

vi.mock("../../../lib/hubspot.js", async () => {
  const actual = await vi.importActual("../../../lib/hubspot.js");
  return {
    ...actual,
    hubspotBatchAssociations: vi.fn(),
    hubspotSearch: vi.fn(),
  };
});

import { hubspotBatchAssociations, hubspotSearch } from "../../../lib/hubspot.js";

beforeEach(() => vi.clearAllMocks());

describe("fetchEngagementsForContact", () => {
  it("fetches meetings and notes, never calls", async () => {
    hubspotBatchAssociations.mockImplementation((token, from, to) => {
      if (to === "meetings") return Promise.resolve(new Map([["contact-1", ["m1"]]]));
      if (to === "notes") return Promise.resolve(new Map([["contact-1", ["n1"]]]));
      return Promise.resolve(new Map());
    });
    hubspotSearch.mockImplementation((token, objectType) => {
      if (objectType === "meetings") {
        return Promise.resolve([{
          id: "m1",
          properties: {
            hs_meeting_start_time: "2026-01-10T10:00:00.000Z",
            hs_meeting_title: "Demo with Acme",
            hs_meeting_body: "Discussed pricing.",
            hs_meeting_outcome: "COMPLETED",
          },
        }]);
      }
      if (objectType === "notes") {
        return Promise.resolve([{
          id: "n1",
          properties: { hs_timestamp: "2026-01-05T09:00:00.000Z", hs_note_body: "Left a voicemail." },
        }]);
      }
      throw new Error(`Unexpected objectType ${objectType}`);
    });

    const { engagements, notes_available } = await fetchEngagementsForContact("tok", "contact-1");

    expect(notes_available).toBe(true);
    expect(engagements.map((e) => e.type)).toEqual(["note", "meeting"]); // chronological
    expect(engagements.some((e) => e.type === "call")).toBe(false);
    expect(hubspotBatchAssociations).not.toHaveBeenCalledWith("tok", "contacts", "calls", expect.anything());
    expect(hubspotSearch).not.toHaveBeenCalledWith("tok", "calls", expect.anything(), expect.anything());
  });

  it("maps hs_meeting_outcome === NO_SHOW to no_show_hint: true, and leaves it false otherwise", async () => {
    hubspotBatchAssociations.mockImplementation((token, from, to) =>
      to === "meetings" ? Promise.resolve(new Map([["c1", ["m1", "m2"]]])) : Promise.resolve(new Map())
    );
    hubspotSearch.mockImplementation((token, objectType) =>
      objectType === "meetings"
        ? Promise.resolve([
            { id: "m1", properties: { hs_meeting_start_time: "2026-01-01T00:00:00.000Z", hs_meeting_outcome: "NO_SHOW" } },
            { id: "m2", properties: { hs_meeting_start_time: "2026-01-02T00:00:00.000Z", hs_meeting_outcome: "COMPLETED" } },
          ])
        : Promise.resolve([])
    );

    const { engagements } = await fetchEngagementsForContact("tok", "c1");
    const byId = Object.fromEntries(engagements.map((e) => [e.id, e]));
    expect(byId.m1.no_show_hint).toBe(true);
    expect(byId.m2.no_show_hint).toBe(false);
  });

  it("degrades to notes_available: false on a HubspotScopeError for notes, without failing the whole request", async () => {
    hubspotBatchAssociations.mockImplementation((token, from, to) => {
      if (to === "meetings") return Promise.resolve(new Map([["c1", ["m1"]]]));
      if (to === "notes") return Promise.reject(new HubspotScopeError("missing scope", ["crm.objects.notes.read"]));
      return Promise.resolve(new Map());
    });
    hubspotSearch.mockImplementation((token, objectType) =>
      objectType === "meetings"
        ? Promise.resolve([{ id: "m1", properties: { hs_meeting_start_time: "2026-01-01T00:00:00.000Z" } }])
        : Promise.resolve([])
    );

    const { engagements, notes_available } = await fetchEngagementsForContact("tok", "c1");
    expect(notes_available).toBe(false);
    expect(engagements).toHaveLength(1);
    expect(engagements[0].type).toBe("meeting");
  });

  it("strips HubSpot's rich-text HTML out of note/meeting bodies so plain-text display doesn't show raw markup", async () => {
    hubspotBatchAssociations.mockImplementation((token, from, to) => {
      if (to === "meetings") return Promise.resolve(new Map([["c1", ["m1"]]]));
      if (to === "notes") return Promise.resolve(new Map([["c1", ["n1"]]]));
      return Promise.resolve(new Map());
    });
    hubspotSearch.mockImplementation((token, objectType) => {
      if (objectType === "meetings") {
        return Promise.resolve([{
          id: "m1",
          properties: { hs_meeting_start_time: "2026-01-01T00:00:00.000Z", hs_meeting_body: "<p>Discussed <strong>pricing</strong> &amp; timeline.</p>" },
        }]);
      }
      return Promise.resolve([{
        id: "n1",
        properties: { hs_timestamp: "2026-01-02T00:00:00.000Z", hs_note_body: "<div><p>Line one</p><p>Line two</p></div>" },
      }]);
    });

    const { engagements } = await fetchEngagementsForContact("tok", "c1");
    const meeting = engagements.find((e) => e.type === "meeting");
    const note = engagements.find((e) => e.type === "note");
    expect(meeting.body).toBe("Discussed pricing & timeline.");
    expect(note.body).toBe("Line one\nLine two");
  });

  it("returns an empty list, not an error, when the contact has no associated meetings or notes", async () => {
    hubspotBatchAssociations.mockResolvedValue(new Map());
    const { engagements, notes_available } = await fetchEngagementsForContact("tok", "c1");
    expect(engagements).toEqual([]);
    expect(notes_available).toBe(true);
    expect(hubspotSearch).not.toHaveBeenCalled();
  });

  it("propagates a non-scope error from the notes fetch instead of swallowing it", async () => {
    hubspotBatchAssociations.mockImplementation((token, from, to) => {
      if (to === "meetings") return Promise.resolve(new Map());
      if (to === "notes") return Promise.reject(new Error("network blip"));
      return Promise.resolve(new Map());
    });
    await expect(fetchEngagementsForContact("tok", "c1")).rejects.toThrow("network blip");
  });
});
