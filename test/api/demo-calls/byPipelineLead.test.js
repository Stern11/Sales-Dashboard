import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/demo-calls/by-pipeline-lead/[pipelineLeadId].js";
import * as queries from "../../../lib/demo-calls/queries.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  getLeadByPipelineLeadId: vi.fn(),
  listCalls: vi.fn(),
}));

function mockReqRes({ method = "GET", query = { pipelineLeadId: "p1" } } = {}) {
  const req = { method, query };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("GET /api/demo-calls/by-pipeline-lead/:pipelineLeadId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("405s for a non-GET method", async () => {
    const { req, res } = mockReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns {lead: null, calls: []} (200, not 404) when no Demo Calls history exists for this pipeline lead", async () => {
    queries.getLeadByPipelineLeadId.mockResolvedValue(null);
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lead: null, calls: [] });
    expect(queries.listCalls).not.toHaveBeenCalled();
  });

  it("returns the lead and its calls when history exists", async () => {
    queries.getLeadByPipelineLeadId.mockResolvedValue({ id: "dc1", company_name: "Acme" });
    queries.listCalls.mockResolvedValue([{ id: "call-1", call_number: 1 }]);
    const { req, res } = mockReqRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ lead: { id: "dc1", company_name: "Acme" }, calls: [{ id: "call-1", call_number: 1 }] });
    expect(queries.listCalls).toHaveBeenCalledWith("dc1");
  });
});
