import { describe, it, expect, vi } from "vitest";
import { withDbErrorHandling, ValidationError, NotFoundError, ConflictError } from "../../../lib/pipeline/respond.js";
import { PipelineDbConfigError } from "../../../lib/db.js";
import { SourceLockedError } from "../../../lib/pipeline/queries.js";

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.body = body; return res; });
  res.setHeader = vi.fn();
  return res;
}

describe("withDbErrorHandling", () => {
  it("responds 200 with the payload and no-store on success", async () => {
    const res = mockRes();
    await withDbErrorHandling(res, async () => ({ ok: true }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });

  it.each([
    [PipelineDbConfigError, 500],
    [ValidationError, 400],
    [NotFoundError, 404],
    [SourceLockedError, 400],
  ])("maps %s to status %i", async (ErrorClass, expectedStatus) => {
    const res = mockRes();
    await withDbErrorHandling(res, async () => { throw new ErrorClass("boom"); });
    expect(res.statusCode).toBe(expectedStatus);
    expect(res.body.error).toBe("boom");
  });

  it("maps ConflictError to 409 and includes the existing lead", async () => {
    const res = mockRes();
    await withDbErrorHandling(res, async () => { throw new ConflictError("dup", { id: "abc", stage: "sql" }); });
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: "dup", existing_lead: { id: "abc", stage: "sql" } });
  });

  it("maps a Postgres unique-violation (code 23505) to a generic 409, not a 500", async () => {
    const res = mockRes();
    const pgErr = new Error("duplicate key value");
    pgErr.code = "23505";
    await withDbErrorHandling(res, async () => { throw pgErr; });
    expect(res.statusCode).toBe(409);
  });

  it("falls back to 500 for an unrecognized error without leaking its message", async () => {
    const res = mockRes();
    // Unrecognized errors here are raw Postgres faults (constraint names,
    // SQLSTATE text) or full upstream HubSpot response bodies. They belong
    // in the server log, not in a browser, so the client gets a fixed string.
    await withDbErrorHandling(res, async () => { throw new Error("relation \"pipeline_leads\" does not exist"); });
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Something went wrong. Please try again.");
    expect(res.body.error).not.toContain("pipeline_leads");
  });
});
