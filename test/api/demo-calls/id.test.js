import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { sessionCookie, TEST_ACTOR_NAME } from "../../helpers/session.js";
import handler from "../../../api/demo-calls/[id].js";
import * as queries from "../../../lib/demo-calls/queries.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  getLeadById: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  listCalls: vi.fn(),
  addCall: vi.fn(),
  updateCall: vi.fn(),
  setStatus: vi.fn(),
  linkPipeline: vi.fn(),
}));

// Write routes resolve their actor from the session cookie (lib/auth/actor.js),
// so the default request carries a valid one. Pass `cookie: null` for the
// unauthenticated path.
let AUTHED_COOKIE;
beforeAll(async () => { AUTHED_COOKIE = await sessionCookie(); });

function mockReqRes({ method = "GET", body = {}, query = { id: "11111111-1111-4111-8111-111111111111" }, cookie = undefined } = {}) {
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

beforeEach(() => vi.clearAllMocks());

describe("GET /api/demo-calls/:id", () => {
  it("returns lead + calls", async () => {
    queries.getLeadById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", company_name: "Acme" });
    queries.listCalls.mockResolvedValue([{ id: "call-1", call_number: 1 }]);
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lead: { id: "11111111-1111-4111-8111-111111111111", company_name: "Acme" }, calls: [{ id: "call-1", call_number: 1 }] });
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { id: "22222222-2222-4222-8222-222222222222" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/demo-calls/:id (no action = edit the lead)", () => {
  it("401s without a session — the actor comes from the session, not the body", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { company_name: "Acme Inc" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("attributes the edit to the session, ignoring an actor supplied in the body", async () => {
    queries.updateLead.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", company_name: "Acme Inc" });
    const { req, res } = mockReqRes({ method: "PATCH", body: { company_name: "Acme Inc", actor: "Someone Else" } });
    await handler(req, res);
    expect(queries.updateLead).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", expect.anything(), TEST_ACTOR_NAME);
  });

  it("400s on an invalid company_scale", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { company_scale: "bogus", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("updates and returns the lead", async () => {
    queries.updateLead.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", company_name: "Acme Inc" });
    const { req, res } = mockReqRes({ method: "PATCH", body: { company_name: "Acme Inc", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.company_name).toBe("Acme Inc");
  });

  it("404s when the lead doesn't exist", async () => {
    queries.updateLead.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "PATCH", body: { company_name: "x", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/demo-calls/:id", () => {
  it("401s without a session — the actor comes from the session, not the body", async () => {
    const { req, res } = mockReqRes({ method: "DELETE", body: { confirm_company_name: "Acme" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("400s when confirm_company_name doesn't match — nothing deleted", async () => {
    queries.getLeadById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", company_name: "Acme" });
    const { req, res } = mockReqRes({ method: "DELETE", body: { confirm_company_name: "Wrong Name", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(queries.deleteLead).not.toHaveBeenCalled();
  });

  it("deletes when confirm_company_name matches exactly", async () => {
    queries.getLeadById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", company_name: "Acme" });
    queries.deleteLead.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    const { req, res } = mockReqRes({ method: "DELETE", body: { confirm_company_name: "Acme", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deleted: true, id: "11111111-1111-4111-8111-111111111111" });
  });
});

describe("POST /api/demo-calls/:id?action=calls", () => {
  beforeEach(() => {
    queries.getLeadById.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", company_name: "Acme" });
  });

  it("400s on an invalid outcome", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "bogus", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "calls" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("401s without a session — the actor comes from the session, not the body", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "completed" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "calls" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "completed", actor: "Aryan" }, query: { id: "22222222-2222-4222-8222-222222222222", action: "calls" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("adds a call and returns it", async () => {
    queries.addCall.mockResolvedValue({ id: "call-1", call_number: 1, outcome: "no_show" });
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "no_show", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "calls" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.call.outcome).toBe("no_show");
  });
});

describe("PATCH /api/demo-calls/:id?action=calls&call_id=", () => {
  it("401s without a session — the actor comes from the session, not the body", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { notes: "went well" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "calls", call_id: "call-1" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("400s on an invalid outcome", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { outcome: "bogus", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "calls", call_id: "call-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the call doesn't exist for this lead", async () => {
    queries.updateCall.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "PATCH", body: { notes: "x", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "calls", call_id: "call-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("updates and returns the call", async () => {
    queries.updateCall.mockResolvedValue({ id: "call-1", transcript_url: "https://x.example/t" });
    const { req, res } = mockReqRes({
      method: "PATCH", body: { transcript_url: "https://x.example/t", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "calls", call_id: "call-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.call.transcript_url).toBe("https://x.example/t");
    expect(queries.updateCall).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", "call-1", expect.objectContaining({ transcript_url: "https://x.example/t" }), "Aryan");
  });
});

describe("POST /api/demo-calls/:id?action=status", () => {
  it("400s on an invalid status", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { status: "bogus", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("401s without a session — the actor comes from the session, not the body", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { status: "irrelevant" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "status" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.setStatus.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "POST", body: { status: "irrelevant", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("sets status irrelevant with a reason", async () => {
    queries.setStatus.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", status: "irrelevant", irrelevant_reason: "wrong ICP" });
    const { req, res } = mockReqRes({ method: "POST", body: { status: "irrelevant", reason: "wrong ICP", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.irrelevant_reason).toBe("wrong ICP");
    expect(queries.setStatus).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", { status: "irrelevant", reason: "wrong ICP", actor: "Aryan" });
  });

  it("reactivates a lead back to active", async () => {
    queries.setStatus.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", status: "active" });
    const { req, res } = mockReqRes({ method: "POST", body: { status: "active", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.setStatus).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", { status: "active", reason: null, actor: "Aryan" });
  });
});

describe("POST /api/demo-calls/:id?action=link-pipeline", () => {
  it("400s when pipeline_lead_id is missing", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "link-pipeline" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("401s without a session — the actor comes from the session, not the body", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { pipeline_lead_id: "p1" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "link-pipeline" }, cookie: null });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("404s when the demo call lead doesn't exist", async () => {
    queries.linkPipeline.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "POST", body: { pipeline_lead_id: "p1", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "link-pipeline" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("links and returns the lead", async () => {
    queries.linkPipeline.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", pipeline_lead_id: "p1" });
    const { req, res } = mockReqRes({ method: "POST", body: { pipeline_lead_id: "p1", actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111", action: "link-pipeline" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.pipeline_lead_id).toBe("p1");
  });
});

describe("POST /api/demo-calls/:id with a missing/unrecognized ?action=", () => {
  it("400s", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { actor: "Aryan" }, query: { id: "11111111-1111-4111-8111-111111111111" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
