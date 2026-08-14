import { describe, it, expect } from "vitest";
import { signSession, verifySession, parseCookies, buildSetCookie } from "../../../lib/auth/session.js";

const SECRET = "test-secret-do-not-use-in-prod";

describe("signSession / verifySession", () => {
  it("round-trips a payload signed and verified with the same secret", async () => {
    const token = await signSession({ email: "aryan@heizen.work", name: "Aryan" }, SECRET, 3600);
    const payload = await verifySession(token, SECRET);
    expect(payload).toMatchObject({ email: "aryan@heizen.work", name: "Aryan" });
    expect(typeof payload.exp).toBe("number");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSession({ email: "aryan@heizen.work" }, SECRET, 3600);
    const payload = await verifySession(token, "a-different-secret");
    expect(payload).toBeNull();
  });

  it("rejects a tampered payload even if the signature segment is untouched", async () => {
    const token = await signSession({ email: "aryan@heizen.work" }, SECRET, 3600);
    const [payloadB64, sigB64] = token.split(".");
    const tampered = `${payloadB64}x.${sigB64}`;
    const payload = await verifySession(tampered, SECRET);
    expect(payload).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signSession({ email: "aryan@heizen.work" }, SECRET, -1);
    const payload = await verifySession(token, SECRET);
    expect(payload).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    await expect(verifySession("not-a-real-token", SECRET)).resolves.toBeNull();
    await expect(verifySession("", SECRET)).resolves.toBeNull();
    await expect(verifySession(null, SECRET)).resolves.toBeNull();
    await expect(verifySession(undefined, SECRET)).resolves.toBeNull();
  });
});

describe("parseCookies", () => {
  it("parses a standard Cookie header into a name/value map", () => {
    expect(parseCookies("session=abc123; theme=dark")).toEqual({ session: "abc123", theme: "dark" });
  });
  it("URL-decodes values", () => {
    expect(parseCookies("session=a%2Fb")).toEqual({ session: "a/b" });
  });
  it("returns an empty object for a missing header", () => {
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies("")).toEqual({});
  });
});

describe("buildSetCookie", () => {
  it("includes the essentials: HttpOnly, SameSite=Lax, Path=/, Max-Age", () => {
    const header = buildSetCookie("session", "abc123", 3600);
    expect(header).toContain("session=abc123");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=3600");
  });
  it("Max-Age=0 for a clearing cookie", () => {
    expect(buildSetCookie("session", "", 0)).toContain("Max-Age=0");
  });
});
