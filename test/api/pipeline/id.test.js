import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { sessionCookie, TEST_ACTOR_NAME } from "../../helpers/session.js";
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

// Every write route now derives its actor from the session cookie, so the
// default request carries a valid one. Pass `cookie: null` to exercise the
// unauthenticated path.
let AUTHED_COOKIE;
beforeAll(async () => { AUTHED_COOKIE = await sessionCookie(); });

function mockReqRes({ method = "POST", body = {}, query = {}, cookie = undefined } = {}) {
  const headers = {};
  const resolved = cookie === undefined ? AUTHED_COOKIE : cookie;
  if (resolved) headers.cookie = resolved;
  const req = { method, body, query, headers };
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
      id: "11111111-1111-4111-8111-111111111111", company_name: "Acme", contact_name: "Jane",
      stage: "sql", priority: "high", deal_size: 1000,
    });
    queries.addNote.mockResolvedValue({ id: "note-1", body: "hi", author: "Aryan", tagged_emails: [] });
    email.notifyTagged.mockResolvedValue(undefined);
  });

  it("400s a POST with no ?action= and no stage-change body", async () => {
    const { req, res } = mockReqRes({ body: {}, query: { id: "11111111-1111-4111-8111-111111111111" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when body is missing", async () => {
    const { req, res } = mockReqRes({ body: { author: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("401s without a session — the note author is the signed-in user, not a body field", async () => {
    const { req, res } = mockReqRes({ body: { body: "hi" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(queries.addNote).not.toHaveBeenCalled();
  });

  it("attributes the note to the session, ignoring an author supplied in the body", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", author: "Someone Else" },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.addNote).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", expect.objectContaining({ author: TEST_ACTOR_NAME }));
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { body: "hi", author: "Aryan" }, query: { id: "22222222-2222-4222-8222-222222222222", action: "notes" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("filters malformed tagged_emails before saving — a bad tag must not fail the whole note", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", tagged_emails: ["valid@heizen.work", "not-an-email", "  ", "also.valid@heizen.work"] },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.addNote).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({ tagged_emails: ["valid@heizen.work", "also.valid@heizen.work"] })
    );
  });

  // The app's only outbound-email path. Without a domain restriction any
  // signed-in user could send branded mail carrying their own note text, from
  // the verified sender, to any address on the internet.
  it("drops tagged emails outside the allowed domain — not an open relay", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", tagged_emails: ["attacker@evil.com", "ok@heizen.work", "spoof@heizen.work.evil.com"] },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.addNote.mock.calls[0][1].tagged_emails).toEqual(["ok@heizen.work"]);
    expect(email.notifyTagged).toHaveBeenCalledTimes(1);
    expect(email.notifyTagged).toHaveBeenCalledWith(expect.objectContaining({ to: "ok@heizen.work" }));
  });

  it("caps the number of recipients one note can email", async () => {
    const many = Array.from({ length: 25 }, (_, i) => `person${i}@heizen.work`);
    const { req, res } = mockReqRes({
      body: { body: "hi", tagged_emails: many },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.addNote.mock.calls[0][1].tagged_emails).toHaveLength(10);
    expect(email.notifyTagged).toHaveBeenCalledTimes(10);
  });

  it("treats a non-array tagged_emails as no tags instead of throwing", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", tagged_emails: "a@heizen.work" },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.addNote.mock.calls[0][1].tagged_emails).toEqual([]);
  });

  it("dedupes repeated tagged_emails", async () => {
    const { req, res } = mockReqRes({
      body: { body: "hi", tagged_emails: ["a@heizen.work", "a@heizen.work"] },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(queries.addNote.mock.calls[0][1].tagged_emails).toEqual(["a@heizen.work"]);
  });

  it("calls notifyTagged once per valid tagged email, passing lead context through", async () => {
    const { req, res } = mockReqRes({
      body: { body: "please review", tagged_emails: ["a@heizen.work", "c@heizen.work"] },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(email.notifyTagged).toHaveBeenCalledTimes(2);
    expect(email.notifyTagged).toHaveBeenCalledWith(expect.objectContaining({
      to: "a@heizen.work", actor: TEST_ACTOR_NAME, companyName: "Acme", contactName: "Jane",
      stage: "sql", priority: "high", dealSize: 1000, leadId: "11111111-1111-4111-8111-111111111111", noteBody: "please review",
    }));
  });

  it("still returns 200 with the saved note when notifyTagged rejects — email is best-effort, not a blocker", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    email.notifyTagged.mockRejectedValue(new Error("Resend is down"));
    const { req, res } = mockReqRes({
      body: { body: "hi", tagged_emails: ["a@heizen.work"] },
      query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.note).toBeTruthy();
    console.error.mockRestore();
  });

  it("skips notifyTagged entirely when there are no tagged emails", async () => {
    const { req, res } = mockReqRes({ body: { body: "hi", author: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "notes" } });
    await handler(req, res);
    expect(email.notifyTagged).not.toHaveBeenCalled();
  });
});

describe("POST /api/pipeline/:id?action=stage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.changeStage.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", stage: "won" });
  });

  it("400s an invalid to_stage", async () => {
    const { req, res } = mockReqRes({ body: { to_stage: "bogus", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "stage" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("401s without a session — the stage change is attributed to the signed-in user", async () => {
    const { req, res } = mockReqRes({ body: { to_stage: "won" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "stage" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(queries.changeStage).not.toHaveBeenCalled();
  });

  it("404s when the lead doesn't exist", async () => {
    queries.changeStage.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { to_stage: "won", actor: "Aryan" }, query: { id: "22222222-2222-4222-8222-222222222222", action: "stage" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("200s and returns the updated lead on success", async () => {
    const { req, res } = mockReqRes({ body: { to_stage: "won", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "stage" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead).toEqual({ id: "11111111-1111-4111-8111-111111111111", stage: "won" });
  });
});
