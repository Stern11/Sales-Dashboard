import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../../api/demo-calls/[id]/calls/[callId].js";
import * as queries from "../../../lib/demo-calls/queries.js";

vi.mock("../../../lib/demo-calls/queries.js", () => ({
  updateCall: vi.fn(),
}));

function mockReqRes({ method = "PATCH", body = {}, query = { id: "lead-1", callId: "call-1" } } = {}) {
  const req = { method, body, query };
  const res = { statusCode: null, body: null };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn();
  return { req, res };
}

describe("PATCH /api/demo-calls/:id/calls/:callId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("405s for a non-PATCH method", async () => {
    const { req, res } = mockReqRes({ method: "POST" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("400s when actor is missing", async () => {
    const { req, res } = mockReqRes({ body: { notes: "went well" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("400s on an invalid outcome", async () => {
    const { req, res } = mockReqRes({ body: { outcome: "bogus", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("404s when the call doesn't exist for this lead", async () => {
    queries.updateCall.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { notes: "x", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("updates and returns the call", async () => {
    queries.updateCall.mockResolvedValue({ id: "call-1", transcript_url: "https://x.example/t" });
    const { req, res } = mockReqRes({ body: { transcript_url: "https://x.example/t", actor: "Aryan" } });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.call.transcript_url).toBe("https://x.example/t");
    expect(queries.updateCall).toHaveBeenCalledWith("lead-1", "call-1", expect.objectContaining({ transcript_url: "https://x.example/t" }), "Aryan");
  });
});
