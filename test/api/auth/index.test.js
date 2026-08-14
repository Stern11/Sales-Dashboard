import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifySession, parseCookies, SESSION_COOKIE_NAME } from "../../../lib/auth/session.js";

// google-auth-library does real network verification; the point of these
// tests is what this handler does with a verified payload, so the library is
// stubbed and the token contents are the input.
const verifyIdToken = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken(...args) { return verifyIdToken(...args); }
  },
}));

const handler = (await import("../../../api/auth/index.js")).default;

const SECRET = "test-session-secret";

function mockReqRes({ method = "POST", body = {}, query = {}, headers = {} } = {}) {
  const req = { method, body, query, headers };
  const res = { statusCode: null, body: null, headers: {} };
  res.status = vi.fn((c) => { res.statusCode = c; return res; });
  res.json = vi.fn((b) => { res.body = b; return res; });
  res.setHeader = vi.fn((k, v) => { res.headers[k] = v; });
  return { req, res };
}

function googlePayload(overrides = {}) {
  return {
    email: "aryan@heizen.work",
    email_verified: true,
    hd: "heizen.work",
    name: "Aryan",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
  process.env.VITE_GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
  verifyIdToken.mockResolvedValue({ getPayload: () => googlePayload() });
});

describe("POST /api/auth?action=login", () => {
  it("issues an HttpOnly session cookie for an allowed account", async () => {
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ authenticated: true, email: "aryan@heizen.work" });

    const cookie = res.headers["Set-Cookie"];
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("signs a session the server can verify back", async () => {
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);

    const cookies = parseCookies(res.headers["Set-Cookie"].split(";")[0]);
    const session = await verifySession(cookies[SESSION_COOKIE_NAME], SECRET);
    expect(session).toMatchObject({ email: "aryan@heizen.work", name: "Aryan" });
  });

  it("verifies the token against our own client id as the audience", async () => {
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);
    expect(verifyIdToken).toHaveBeenCalledWith(
      expect.objectContaining({ idToken: "tok", audience: "client-id.apps.googleusercontent.com" })
    );
  });

  it("rejects an outside domain", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => googlePayload({ email: "someone@evil.com", hd: "evil.com" }),
    });
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });

  // The email suffix alone is the weaker signal: a consumer Google account
  // can carry any email, but only a Workspace account gets `hd`.
  it("rejects a consumer account whose email merely looks right", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => googlePayload({ hd: undefined }),
    });
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.headers["Set-Cookie"]).toBeUndefined();
  });

  it("rejects a subdomain lookalike", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => googlePayload({ email: "x@heizen.work.evil.com", hd: "heizen.work.evil.com" }),
    });
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects an unverified email", async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => googlePayload({ email_verified: false }) });
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects a token Google won't verify, without leaking the library's error", async () => {
    verifyIdToken.mockRejectedValue(new Error("Token used too late, 1699999999 > 1699999998"));
    const { req, res } = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).not.toContain("1699999999");
  });

  it("400s when no credential is supplied", async () => {
    const { req, res } = mockReqRes({ body: {}, query: { action: "login" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/auth (status)", () => {
  it("reports an unauthenticated visitor rather than erroring", async () => {
    const { req, res } = mockReqRes({ method: "GET" });
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it("reports the signed-in identity for a valid cookie", async () => {
    const login = mockReqRes({ body: { credential: "tok" }, query: { action: "login" } });
    await handler(login.req, login.res);
    const cookie = login.res.headers["Set-Cookie"].split(";")[0];

    const { req, res } = mockReqRes({ method: "GET", headers: { cookie } });
    await handler(req, res);
    expect(res.body).toMatchObject({ authenticated: true, email: "aryan@heizen.work" });
  });

  it("ignores a forged cookie", async () => {
    const { req, res } = mockReqRes({
      method: "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=not.a.real.token` },
    });
    await handler(req, res);
    expect(res.body).toEqual({ authenticated: false });
  });
});

describe("POST /api/auth?action=logout", () => {
  it("clears the cookie", async () => {
    const { req, res } = mockReqRes({ query: { action: "logout" } });
    await handler(req, res);
    expect(res.body).toEqual({ authenticated: false });
    expect(res.headers["Set-Cookie"]).toMatch(/Max-Age=0/);
  });
});

describe("method and action handling", () => {
  it("400s an unrecognized action", async () => {
    const { req, res } = mockReqRes({ query: { action: "escalate" } });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("405s a method it doesn't serve, advertising what it does", async () => {
    const { req, res } = mockReqRes({ method: "DELETE" });
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, POST");
  });
});
