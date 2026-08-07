import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getToken, hubspotGet, chunk, sleep, HubspotConfigError, HubspotScopeError } from "../../lib/hubspot.js";

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("chunk", () => {
  it("splits into groups of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns one group when size >= length", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
  it("returns an empty array for an empty input", () => {
    expect(chunk([], 5)).toEqual([]);
  });
});

describe("sleep", () => {
  it("resolves", async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });
});

describe("getToken", () => {
  const original = process.env.HUBSPOT_TOKEN;
  afterEach(() => { process.env.HUBSPOT_TOKEN = original; });

  it("throws HubspotConfigError when unset", () => {
    delete process.env.HUBSPOT_TOKEN;
    expect(() => getToken()).toThrow(HubspotConfigError);
  });

  it("returns the token when set", () => {
    process.env.HUBSPOT_TOKEN = "test-token";
    expect(getToken()).toBe("test-token");
  });
});

describe("hubspotGet", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => { globalThis.fetch = vi.fn(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  it("sends a bearer-authenticated GET and returns the parsed body", async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(200, { results: [1, 2] }));
    const body = await hubspotGet("tok", "/crm/v3/objects/contacts/1");
    expect(body).toEqual({ results: [1, 2] });
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/1");
    expect(opts.headers.Authorization).toBe("Bearer tok");
  });

  it("retries once on 429 and succeeds on the follow-up", async () => {
    globalThis.fetch
      .mockResolvedValueOnce(jsonResponse(429, {}, { "retry-after": "0.01" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const body = await hubspotGet("tok", "/x");
    expect(body).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws HubspotScopeError on 403 with the required scopes surfaced", async () => {
    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse(403, { errors: [{ context: { requiredGranularScopes: ["crm.objects.deals.read"] } }] })
    );
    await expect(hubspotGet("tok", "/x")).rejects.toBeInstanceOf(HubspotScopeError);
    globalThis.fetch.mockResolvedValueOnce(
      jsonResponse(403, { errors: [{ context: { requiredGranularScopes: ["crm.objects.deals.read"] } }] })
    );
    await expect(hubspotGet("tok", "/x")).rejects.toMatchObject({ requiredScopes: ["crm.objects.deals.read"] });
  });

  it("throws a plain Error for other non-ok statuses", async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(500, { message: "server error" }));
    await expect(hubspotGet("tok", "/x")).rejects.toThrow(/500/);
  });
});
