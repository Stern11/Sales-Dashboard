import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/pipeline/[id]/index.js";
import * as queries from "../../../lib/pipeline/queries.js";
import * as email from "../../../lib/email.js";

vi.mock("../../../lib/pipeline/queries.js", () => ({
  addNote: vi.fn(),
  getLeadById: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  listNotes: vi.fn(),
  listStageHistory: vi.fn(),
  changeStage: vi.fn(),
}));
vi.mock("../../../lib/email.js", () => ({
  notifyTagged: vi.fn(),
}));

function mockReqRes({ method = "POST", body = {}, query = {} } = {}) {
  const req = { method, body, query, headers: {} };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("POST /api/pipeline/:id?action=notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.getLeadById.mockResolvedValue({
      id: "lead-1", company_name: "Acme", contact_name: "Jane",
      stage: "sql", priority: "high", deal_size: 1000,
    });
    queries.addNote.mockResolvedValue({ id: "note-1", body: "hi", author: "Aryan", tagged_emails: [] });
    email.notifyTagged.mockResolvedValue(undefined);
  });

  it("400s a POST with no ?action= and no stage-change body", async () => {
    const { req, res } = mockReqRes({ body: {}, query: { id: "lead-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when body is missing", async () => {
    const { req, res } = mockReqRes({ body: { author: "Aryan" }, query: { id: "lead-1", action: "notes" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when author is missing", async () => {
    const { req, res } = mockReqRes({ body: { body: "hi" }, query: { id: "lead-1", action: "notes" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { body: "hi", author: "Aryan" }, query: { id: "missing", action: "notes" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("filters malformed tagged_emails before saving — a bad tag must not fail the whole note", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", author: "Aryan", tagged_emails: ["valid@heizen.work", "not-an-email", "  ", "also.valid@x.co"] },
      query: { id: "lead-1", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.addNote).toHaveBeenCalledWith(
      "lead-1",
      expect.objectContaining({ tagged_emails: ["valid@heizen.work", "also.valid@x.co"] })
    );
  });

  it("dedupes repeated tagged_emails", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", author: "Aryan", tagged_emails: ["a@b.com", "a@b.com"] },
      query: { id: "lead-1", action: "notes" },
    });
    await handler(req, res);
    expect(queries.addNote.mock.calls[0][1].tagged_emails).toEqual(["a@b.com"]);
  });

  it("calls notifyTagged once per valid tagged email, passing lead context through", async () => {
    const { req, res } = mockReqRes({
      body: { body: "please review", author: "Aryan", tagged_emails: ["a@b.com", "c@d.com"] },
      query: { id: "lead-1", action: "notes" },
    });
    await handler(req, res);
    expect(email.notifyTagged).toHaveBeenCalledTimes(2);
    expect(email.notifyTagged).toHaveBeenCalledWith(expect.objectContaining({
      to: "a@b.com", actor: "Aryan", companyName: "Acme", contactName: "Jane",
      stage: "sql", priority: "high", dealSize: 1000, leadId: "lead-1", noteBody: "please review",
    }));
  });

  it("still returns 200 with the saved note when notifyTagged rejects — email is best-effort, not a blocker", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    email.notifyTagged.mockRejectedValue(new Error("Resend is down"));
    const { req, res } = mockReqRes({
      body: { body: "hi", author: "Aryan", tagged_emails: ["a@b.com"] },
      query: { id: "lead-1", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.note).toBeTruthy();
    console.error.mockRestore();
  });

  it("skips notifyTagged entirely when there are no tagged emails", async () => {
    const { req, res } = mockReqRes({ body: { body: "hi", author: "Aryan" }, query: { id: "lead-1", action: "notes" } });
    await handler(req, res);
    expect(email.notifyTagged).not.toHaveBeenCalled();
  });
});

describe("POST /api/pipeline/:id?action=stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.changeStage.mockResolvedValue({ id: "lead-1", stage: "won" });
  });

  it("400s an invalid to_stage", async () => {
    const { req, res } = mockReqRes({ body: { to_stage: "bogus", actor: "Aryan" }, query: { id: "lead-1", action: "stage" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ body: { to_stage: "won" }, query: { id: "lead-1", action: "stage" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.changeStage.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { to_stage: "won", actor: "Aryan" }, query: { id: "missing", action: "stage" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("200s and returns the updated lead on success", async () => {
    const { req, res } = mockReqRes({ body: { to_stage: "won", actor: "Aryan" }, query: { id: "lead-1", action: "stage" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead).toEqual({ id: "lead-1", stage: "won" });
  });
});
