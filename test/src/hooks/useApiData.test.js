import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// useApiData's registry is module state, so each test gets a fresh copy of
// the module. sessionStorage/document are stubbed because vitest runs this
// suite in the `node` environment (see vitest.config.js) — the hook itself
// is exercised through its exported helpers rather than by rendering, since
// there's no jsdom or Testing Library in this project.
function installBrowserGlobals() {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  globalThis.document = { hidden: false, addEventListener: () => {} };
  return store;
}

let cacheStore;

beforeEach(() => {
  vi.resetModules();
  cacheStore = installBrowserGlobals();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.sessionStorage;
  delete globalThis.document;
});

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("useApiData request sharing", () => {
  // The reason this registry exists: /api/pipeline had three independent
  // consumers and /api/sources?period=lifetime — a ~10-12s scan of every
  // contact in the portal — was triggered afresh by each one.
  it("issues one request when several consumers subscribe to the same url", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [] }));
    const { __test } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/pipeline");
    await Promise.all([
      __test.load(entry, false),
      __test.load(entry, false),
      __test.load(entry, false),
    ]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("shares the resolved data with every subscriber", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [{ id: "a" }] }));
    const { __test } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/pipeline");
    const seenA = [];
    const seenB = [];
    entry.subscribers.add((s) => seenA.push(s));
    entry.subscribers.add((s) => seenB.push(s));

    await __test.load(entry, false);

    // Each subscriber sees the loading snapshot first, then the resolved one.
    // What matters is that both are told about the same resolved data from
    // the single shared request.
    expect(seenA.at(-1).data.leads[0].id).toBe("a");
    expect(seenB.at(-1).data.leads[0].id).toBe("a");
    expect(seenA.at(-1).loading).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("starts a new request once the previous one has settled", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [] }));
    const { __test } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/pipeline");
    await __test.load(entry, false);
    await __test.load(entry, true);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("useApiData failure handling", () => {
  it("keeps data on screen when a background revalidation fails", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [{ id: "a" }] }));
    const { __test } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/pipeline");
    await __test.load(entry, false);

    globalThis.fetch = vi.fn(async () => { throw new Error("network down"); });
    await __test.load(entry, true);

    expect(entry.data.leads[0].id).toBe("a");
    expect(entry.error).toBeNull();
  });

  it("surfaces the error when there is nothing already on screen", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("network down"); });
    const { __test } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/abm?segment=x");
    await __test.load(entry, false);

    expect(entry.error).toBe("network down");
  });

  // Otherwise an expired 30-day cookie leaves "Not authenticated." on every
  // page forever, with no path back to the login screen.
  it("reports a 401 as an expired session rather than an error message", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: "Not authenticated." }, 401));
    const { __test } = await import("../../../src/hooks/useApiData.js");
    const { onSessionExpired } = await import("../../../src/lib/sessionExpired.js");

    const expired = vi.fn();
    onSessionExpired(expired);

    const entry = __test.getEntry("/api/pipeline");
    await __test.load(entry, false);

    expect(expired).toHaveBeenCalledTimes(1);
    expect(entry.error).toBeNull();
  });
});

describe("useApiData polling", () => {
  it("skips the scheduled refetch while the tab is hidden", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [] }));
    const { __test, REFRESH_MS } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/sources?period=lifetime");
    __test.startPolling(entry);

    globalThis.document.hidden = true;
    vi.advanceTimersByTime(REFRESH_MS * 3);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    globalThis.document.hidden = false;
    vi.advanceTimersByTime(REFRESH_MS);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    __test.stopPolling(entry);
  });

  it("stops the interval when the last subscriber leaves", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [] }));
    const { __test, REFRESH_MS } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/pipeline");
    __test.startPolling(entry);
    __test.stopPolling(entry);

    vi.advanceTimersByTime(REFRESH_MS * 2);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("useApiData caching", () => {
  it("seeds a new entry from sessionStorage so a reload paints immediately", async () => {
    cacheStore.set("dashboard-cache:/api/pipeline", JSON.stringify({ leads: [{ id: "cached" }] }));
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [] }));
    const { __test } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/pipeline");
    expect(entry.data.leads[0].id).toBe("cached");
    expect(entry.loading).toBe(false);
  });

  it("treats an entry with no cached response as still loading", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ leads: [] }));
    const { __test } = await import("../../../src/hooks/useApiData.js");

    const entry = __test.getEntry("/api/pipeline");
    expect(entry.data).toBeNull();
    expect(entry.loading).toBe(true);
  });
});
