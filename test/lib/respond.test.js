import { describe, it, expect, vi } from "vitest";
import { withHubspotErrorHandling } from "../../lib/respond.js";
import { HubspotConfigError, HubspotScopeError } from "../../lib/hubspot.js";

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.body = body; return res; });
  res.setHeader = vi.fn();
  return res;
}

describe("withHubspotErrorHandling", () => {
  it("responds 200, stamps generated_at, and sets the live-cache header on success", async () => {
    const res = mockRes();
    await withHubspotErrorHandling(res, async () => ({ leads: [] }));
    expect(res.statusCode).toBe(200);
    expect(res.body.leads).toEqual([]);
    expect(typeof res.body.generated_at).toBe("string");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", expect.stringContaining("s-maxage=300"));
  });

  it("maps HubspotConfigError to 500", async () => {
    const res = mockRes();
    await withHubspotErrorHandling(res, async () => { throw new HubspotConfigError("no token"); });
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("no token");
  });

  it("maps HubspotScopeError to 403 and surfaces requiredScopes", async () => {
    const res = mockRes();
    await withHubspotErrorHandling(res, async () => { throw new HubspotScopeError("missing scope", ["crm.objects.contacts.read"]); });
    expect(res.statusCode).toBe(403);
    expect(res.body.requiredScopes).toEqual(["crm.objects.contacts.read"]);
  });

  it("falls back to 500 for an unrecognized error", async () => {
    const res = mockRes();
    await withHubspotErrorHandling(res, async () => { throw new Error("boom"); });
    expect(res.statusCode).toBe(500);
  });
});
