import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/demo-calls/[id]/status.js";
import * as queries from "../../../lib/demo-calls/queries.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  setStatus: vi.fn(),
}));

function mockReqRes({ method = "POST", body = {}, query = { id: "lead-1" } } = {}) {
  const req = { method, body, query };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("POST /api/demo-calls/:id/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("405s for a non-POST method", async () => {
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s on an invalid status", async () => {
    const { req, res } = mockReqRes({ body: { status: "bogus", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ body: { status: "irrelevant" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the lead doesn't exist", async () => {
    queries.setStatus.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { status: "irrelevant", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("sets status irrelevant with a reason", async () => {
    queries.setStatus.mockResolvedValue({ id: "lead-1", status: "irrelevant", irrelevant_reason: "wrong ICP" });
    const { req, res } = mockReqRes({ body: { status: "irrelevant", reason: "wrong ICP", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.irrelevant_reason).toBe("wrong ICP");
    expect(queries.setStatus).toHaveBeenCalledWith("lead-1", { status: "irrelevant", reason: "wrong ICP", actor: "Aryan" });
  });

  it("reactivates a lead back to active", async () => {
    queries.setStatus.mockResolvedValue({ id: "lead-1", status: "active" });
    const { req, res } = mockReqRes({ body: { status: "active", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(queries.setStatus).toHaveBeenCalledWith("lead-1", { status: "active", reason: null, actor: "Aryan" });
  });
});
