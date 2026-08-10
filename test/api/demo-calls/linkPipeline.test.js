import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/demo-calls/[id]/link-pipeline.js";
import * as queries from "../../../lib/demo-calls/queries.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  linkPipeline: vi.fn(),
}));

function mockReqRes({ method = "POST", body = {}, query = { id: "lead-1" } } = {}) {
  const req = { method, body, query };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("POST /api/demo-calls/:id/link-pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("405s for a non-POST method", async () => {
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s when pipeline_lead_id is missing", async () => {
    const { req, res } = mockReqRes({ body: { actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ body: { pipeline_lead_id: "p1" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the demo call lead doesn't exist", async () => {
    queries.linkPipeline.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { pipeline_lead_id: "p1", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("links and returns the lead", async () => {
    queries.linkPipeline.mockResolvedValue({ id: "lead-1", pipeline_lead_id: "p1" });
    const { req, res } = mockReqRes({ body: { pipeline_lead_id: "p1", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.lead.pipeline_lead_id).toBe("p1");
  });
});
