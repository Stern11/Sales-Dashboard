import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/pipeline/check.js";
import * as queries from "../../../lib/pipeline/queries.js";

vi.mock("../../../lib/pipeline/queries.js", () => ({
  checkContactIds: vi.fn(),
}));

function mockReqRes({ method = "POST", body = {} } = {}) {
  const req = { method, body };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("POST /api/pipeline/check", () => {
  beforeEach(() => vi.clearAllMocks());

  it("405s for GET — the old GET-based contact_ids query-string contract was intentionally retired (URL-length risk at scale)", async () => {
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns in_pipeline keyed by hubspot_contact_id", async () => {
    queries.checkContactIds.mockResolvedValue([{ hubspot_contact_id: "123", id: "lead-1", stage: "sql" }]);
    const { req, res } = mockReqRes({ body: { contact_ids: ["123", "456"] } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.in_pipeline).toEqual({ "123": { id: "lead-1", stage: "sql" } });
    expect(queries.checkContactIds).toHaveBeenCalledWith(["123", "456"]);
  });

  it("handles a missing/non-array contact_ids body defensively instead of throwing", async () => {
    queries.checkContactIds.mockResolvedValue([]);
    const { req, res } = mockReqRes({ body: {} });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.in_pipeline).toEqual({});
  });

  it("trims whitespace and drops blank ids before querying", async () => {
    queries.checkContactIds.mockResolvedValue([]);
    const { req, res } = mockReqRes({ body: { contact_ids: [" 123 ", "", "  "] } });
    await handler(req, res);
    expect(queries.checkContactIds).toHaveBeenCalledWith(["123"]);
  });
});
