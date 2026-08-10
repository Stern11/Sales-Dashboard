import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/demo-calls/[id]/calls.js";
import * as queries from "../../../lib/demo-calls/queries.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  addCall: vi.fn(),
  getLeadById: vi.fn(),
}));

function mockReqRes({ method = "POST", body = {}, query = { id: "lead-1" } } = {}) {
  const req = { method, body, query };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("POST /api/demo-calls/:id/calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queries.getLeadById.mockResolvedValue({ id: "lead-1", company_name: "Acme" });
  });

  it("405s for a non-POST method", async () => {
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s on an invalid outcome", async () => {
    const { req, res } = mockReqRes({ body: { outcome: "bogus", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ body: { outcome: "completed" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.getLeadById.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { outcome: "completed", actor: "Aryan" }, query: { id: "missing" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("adds a call and returns it", async () => {
    queries.addCall.mockResolvedValue({ id: "call-1", call_number: 1, outcome: "no_show" });
    const { req, res } = mockReqRes({ body: { outcome: "no_show", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.call.outcome).toBe("no_show");
  });
});
