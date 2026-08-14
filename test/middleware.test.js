import { describe, it, expect, beforeEach } from "vitest";
import middleware, { config } from "../middleware.js";
import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../lib/auth/session.js";

// This is the file that gates every /api/* route — by its own header comment,
// "what actually enforces 'only signed-in @heizen.work accounts can use the
// app'". It had no tests.

const SECRET = "test-session-secret";

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

async function cookieFor({ email = "aryan@heizen.work", name = "Aryan", secret = SECRET, maxAge = SESSION_MAX_AGE_SECONDS } = {}) {
  const token = await signSession({ email, name }, secret, maxAge);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}

function request(pathname, cookie) {
  return new Request(`https://dashboard.heizen.work${pathname}`, {
    headers: cookie ? { cookie } : {},
  });
}

/** Middleware returns undefined to let a request through, or a Response to stop it. */
const passed = (result) => result === undefined;

describe("matcher", () => {
  it("covers every API route", () => {
    expect(config.matcher).toEqual(["/api/:path*"]);
  });
});

describe("the auth endpoint exemption", () => {
  it("lets /api/auth through unauthenticated — login has to be reachable first", async () => {
    expect(passed(await middleware(request("/api/auth")))).toBe(true);
  });

  it("lets nested auth paths through", async () => {
    expect(passed(await middleware(request("/api/auth/callback")))).toBe(true);
  });

  // The exemption used to be a bare startsWith, so a route merely *named*
  // adjacently would have inherited it silently.
  it("does not extend the exemption to lookalike route names", async () => {
    for (const path of ["/api/authz", "/api/auth-debug", "/api/authorize"]) {
      const result = await middleware(request(path));
      expect(passed(result), `${path} should be gated`).toBe(false);
      expect(result.status).toBe(401);
    }
  });
});

describe("gating", () => {
  it("401s a request with no cookie", async () => {
    const result = await middleware(request("/api/pipeline"));
    expect(result.status).toBe(401);
    expect(result.headers.get("cache-control")).toBe("no-store");
    await expect(result.json()).resolves.toEqual({ error: "Not authenticated." });
  });

  it("lets a valid session through", async () => {
    expect(passed(await middleware(request("/api/pipeline", await cookieFor())))).toBe(true);
  });

  it("401s a cookie signed with the wrong secret", async () => {
    const forged = await cookieFor({ secret: "some-other-secret" });
    expect((await middleware(request("/api/pipeline", forged))).status).toBe(401);
  });

  it("401s a tampered cookie", async () => {
    const cookie = await cookieFor();

    // Tamper the *first* character of the signature, not the last. The
    // signature is 32 bytes encoded in 43 base64url characters — 258 bits of
    // alphabet for 256 bits of data — so the final character's low 4 bits
    // decode to nothing, and several distinct last characters yield byte-for-
    // byte identical signatures. Mutating it therefore only *sometimes*
    // invalidates the cookie, which makes for a test that passes ~15 runs out
    // of 16. The first character has no such slack.
    const [value, sig] = cookie.split(".");
    const tampered = `${value}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
    expect(tampered).not.toBe(cookie);

    expect((await middleware(request("/api/pipeline", tampered))).status).toBe(401);
  });

  it("401s an expired session", async () => {
    const expired = await cookieFor({ maxAge: -60 });
    expect((await middleware(request("/api/pipeline", expired))).status).toBe(401);
  });

  it("401s garbage in the cookie", async () => {
    expect((await middleware(request("/api/pipeline", `${SESSION_COOKIE_NAME}=nonsense`))).status).toBe(401);
  });

  // The cookie lasts 30 days with no server-side session store to revoke
  // against, so the domain rule is re-checked per request rather than trusted
  // from whenever the cookie was minted. Someone who loses access shouldn't
  // keep it until their cookie happens to expire.
  it("401s a validly-signed session for an address outside the allowed domain", async () => {
    const outsider = await cookieFor({ email: "someone@evil.com" });
    expect((await middleware(request("/api/pipeline", outsider))).status).toBe(401);
  });

  it("401s a subdomain lookalike", async () => {
    const lookalike = await cookieFor({ email: "x@heizen.work.evil.com" });
    expect((await middleware(request("/api/pipeline", lookalike))).status).toBe(401);
  });
});

describe("when SESSION_SECRET is missing", () => {
  // Not a forgery risk — WebCrypto refuses a zero-length HMAC key — but it
  // used to throw a DataError out of verifySession and surface as a 500 on
  // every request. Failing closed with a 401 is the intended behavior.
  it("rejects every request with a 401 rather than throwing", async () => {
    const cookie = await cookieFor();
    delete process.env.SESSION_SECRET;

    const result = await middleware(request("/api/pipeline", cookie));
    expect(result.status).toBe(401);
  });
});
