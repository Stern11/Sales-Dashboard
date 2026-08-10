import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/demo-calls/[id]/index.js";
import * as queries from "../../../lib/demo-calls/queries.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  getLeadById: vi.fn(),
  updateLead: vi.fn(),
  deleteLead: vi.fn(),
  listCalls: vi.fn(),
}));

function mockReqRes({ method = "GET", body = {}, query = { id: "lead-1" } } = {}) {
  const req = { method, body, query };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("GET /api/demo-calls/:id", () => {
  beforeEach(() => vi.clearAllMocks());

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

describe("PATCH /api/demo-calls/:id", () => {
  beforeEach(() => vi.clearAllMocks());

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
  beforeEach(() => vi.clearAllMocks());

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

  it("405s for an unsupported method", async () => {
    const { req, res } = mockReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
