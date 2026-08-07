import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/pipeline/[id]/notes.js";
import * as queries from "../../../lib/pipeline/queries.js";
import * as email from "../../../lib/email.js";

vi.mock("../../../lib/pipeline/queries.js", () => ({
  addNote: vi.fn(),
  getLeadById: vi.fn(),
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

describe("POST /api/pipeline/:id/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.getLeadById.mockResolvedValue({
      id: "lead-1", company_name: "Acme", contact_name: "Jane",
      stage: "sql", priority: "high", deal_size: 1000,
    });
    queries.addNote.mockResolvedValue({ id: "note-1", body: "hi", author: "Aryan", tagged_emails: [] });
    email.notifyTagged.mockResolvedValue(undefined);
  });

  it("405s for a non-POST method", async () => {
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s when body is missing", async () => {
    const { req, res } = mockReqRes({ body: { author: "Aryan" }, query: { id: "lead-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when author is missing", async () => {
    const { req, res } = mockReqRes({ body: { body: "hi" }, query: { id: "lead-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { body: "hi", author: "Aryan" }, query: { id: "missing" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("filters malformed tagged_emails before saving — a bad tag must not fail the whole note", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", author: "Aryan", tagged_emails: ["valid@heizen.work", "not-an-email", "  ", "also.valid@x.co"] },
      query: { id: "lead-1" },
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
      query: { id: "lead-1" },
    });
    await handler(req, res);
    expect(queries.addNote.mock.calls[0][1].tagged_emails).toEqual(["a@b.com"]);
  });

  it("calls notifyTagged once per valid tagged email, passing lead context through", async () => {
    const { req, res } = mockReqRes({
      body: { body: "please review", author: "Aryan", tagged_emails: ["a@b.com", "c@d.com"] },
      query: { id: "lead-1" },
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
      query: { id: "lead-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.note).toBeTruthy();
    console.error.mockRestore();
  });

  it("skips notifyTagged entirely when there are no tagged emails", async () => {
    const { req, res } = mockReqRes({ body: { body: "hi", author: "Aryan" }, query: { id: "lead-1" } });
    await handler(req, res);
    expect(email.notifyTagged).not.toHaveBeenCalled();
  });
});
