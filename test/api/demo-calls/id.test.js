import { describe, it, expect, vi, beforeEach } from "vitest";
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

function mockReqRes({ method = "GET", body = {}, query = { id: "lead-1" } } = {}) {
  const req = { method, body, query };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/demo-calls/:id", () => {
  it("returns lead + calls", async () => {
    queries.getLeadById.mockResolvedValue({ id: "lead-1", company_name: "Acme" });
    queries.listCalls.mockResolvedValue([{ id: "call-1", call_number: 1 }]);
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lead: { id: "lead-1", company_name: "Acme" }, calls: [{ id: "call-1", call_number: 1 }] });
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ query: { id: "missing" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /api/demo-calls/:id (no action = edit the lead)", () => {
  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { company_name: "Acme Inc" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s on an invalid company_scale", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { company_scale: "bogus", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("updates and returns the lead", async () => {
    queries.updateLead.mockResolvedValue({ id: "lead-1", company_name: "Acme Inc" });
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
  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ method: "DELETE", body: { confirm_company_name: "Acme" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when confirm_company_name doesn't match — nothing deleted", async () => {
    queries.getLeadById.mockResolvedValue({ id: "lead-1", company_name: "Acme" });
    const { req, res } = mockReqRes({ method: "DELETE", body: { confirm_company_name: "Wrong Name", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(queries.deleteLead).not.toHaveBeenCalled();
  });

  it("deletes when confirm_company_name matches exactly", async () => {
    queries.getLeadById.mockResolvedValue({ id: "lead-1", company_name: "Acme" });
    queries.deleteLead.mockResolvedValue({ id: "lead-1" });
    const { req, res } = mockReqRes({ method: "DELETE", body: { confirm_company_name: "Acme", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deleted: true, id: "lead-1" });
  });
});

describe("POST /api/demo-calls/:id?action=calls", () => {
  beforeEach(() => {
    queries.getLeadById.mockResolvedValue({ id: "lead-1", company_name: "Acme" });
  });

  it("400s on an invalid outcome", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "bogus", actor: "Aryan" }, query: { id: "lead-1", action: "calls" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "completed" }, query: { id: "lead-1", action: "calls" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "completed", actor: "Aryan" }, query: { id: "missing", action: "calls" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("adds a call and returns it", async () => {
    queries.addCall.mockResolvedValue({ id: "call-1", call_number: 1, outcome: "no_show" });
    const { req, res } = mockReqRes({ method: "POST", body: { outcome: "no_show", actor: "Aryan" }, query: { id: "lead-1", action: "calls" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.call.outcome).toBe("no_show");
  });
});

describe("PATCH /api/demo-calls/:id?action=calls&call_id=", () => {
  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { notes: "went well" }, query: { id: "lead-1", action: "calls", call_id: "call-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s on an invalid outcome", async () => {
    const { req, res } = mockReqRes({ method: "PATCH", body: { outcome: "bogus", actor: "Aryan" }, query: { id: "lead-1", action: "calls", call_id: "call-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the call doesn't exist for this lead", async () => {
    queries.updateCall.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "PATCH", body: { notes: "x", actor: "Aryan" }, query: { id: "lead-1", action: "calls", call_id: "call-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("updates and returns the call", async () => {
    queries.updateCall.mockResolvedValue({ id: "call-1", transcript_url: "https://x.example/t" });
    const { req, res } = mockReqRes({
      method: "PATCH", body: { transcript_url: "https://x.example/t", actor: "Aryan" }, query: { id: "lead-1", action: "calls", call_id: "call-1" },
    });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.call.transcript_url).toBe("https://x.example/t");
    expect(queries.updateCall).toHaveBeenCalledWith("lead-1", "call-1", expect.objectContaining({ transcript_url: "https://x.example/t" }), "Aryan");
  });
});

describe("POST /api/demo-calls/:id?action=status", () => {
  it("400s on an invalid status", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { status: "bogus", actor: "Aryan" }, query: { id: "lead-1", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { status: "irrelevant" }, query: { id: "lead-1", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.setStatus.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "POST", body: { status: "irrelevant", actor: "Aryan" }, query: { id: "lead-1", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("sets status irrelevant with a reason", async () => {
    queries.setStatus.mockResolvedValue({ id: "lead-1", status: "irrelevant", irrelevant_reason: "wrong ICP" });
    const { req, res } = mockReqRes({ method: "POST", body: { status: "irrelevant", reason: "wrong ICP", actor: "Aryan" }, query: { id: "lead-1", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.irrelevant_reason).toBe("wrong ICP");
    expect(queries.setStatus).toHaveBeenCalledWith("lead-1", { status: "irrelevant", reason: "wrong ICP", actor: "Aryan" });
  });

  it("reactivates a lead back to active", async () => {
    queries.setStatus.mockResolvedValue({ id: "lead-1", status: "active" });
    const { req, res } = mockReqRes({ method: "POST", body: { status: "active", actor: "Aryan" }, query: { id: "lead-1", action: "status" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.setStatus).toHaveBeenCalledWith("lead-1", { status: "active", reason: null, actor: "Aryan" });
  });
});

describe("POST /api/demo-calls/:id?action=link-pipeline", () => {
  it("400s when pipeline_lead_id is missing", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { actor: "Aryan" }, query: { id: "lead-1", action: "link-pipeline" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { pipeline_lead_id: "p1" }, query: { id: "lead-1", action: "link-pipeline" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the demo call lead doesn't exist", async () => {
    queries.linkPipeline.mockResolvedValue(null);
    const { req, res } = mockReqRes({ method: "POST", body: { pipeline_lead_id: "p1", actor: "Aryan" }, query: { id: "lead-1", action: "link-pipeline" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("links and returns the lead", async () => {
    queries.linkPipeline.mockResolvedValue({ id: "lead-1", pipeline_lead_id: "p1" });
    const { req, res } = mockReqRes({ method: "POST", body: { pipeline_lead_id: "p1", actor: "Aryan" }, query: { id: "lead-1", action: "link-pipeline" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.pipeline_lead_id).toBe("p1");
  });
});

describe("POST /api/demo-calls/:id with a missing/unrecognized ?action=", () => {
  it("400s", async () => {
    const { req, res } = mockReqRes({ method: "POST", body: { actor: "Aryan" }, query: { id: "lead-1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
