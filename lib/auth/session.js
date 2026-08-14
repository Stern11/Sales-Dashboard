// Signed session cookie — HMAC-SHA256 over a JSON payload, verified with the
// Web Crypto API (`crypto.subtle`) rather than a Node-only API. That's
// deliberate: this file is shared by api/auth/index.js (a normal Node
// serverless function) and middleware.js (Vercel Edge Middleware, which only
// exposes Web-standard globals) — Web Crypto is the one thing both runtimes
// have in common, so one implementation covers both instead of two.
//
// Not a JWT — there's no need for the interop JWTs exist for for this app's
// own cookie, and hand-rolling that formats matters less than getting the
// signature check right, which this keeps as small as possible.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded + "===".slice((padded.length + 3) % 4);
  const binary = atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** `payload` should be a plain JSON-serializable object — email/name here, nothing sensitive (it's visible to the browser, just not forgeable without `secret`). */
export async function signSession(payload, secret, maxAgeSeconds) {
  const withExpiry = { ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds };
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(withExpiry)));
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(signature)}`;
}

/** Returns the payload if the signature is valid and it hasn't expired, otherwise null — never throws on a malformed/tampered token. */
export async function verifySession(token, secret) {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64) return null;

  let signatureBytes, payloadBytes;
  try {
    signatureBytes = fromBase64Url(sigB64);
    payloadBytes = fromBase64Url(payloadB64);
  } catch {
    return null;
  }

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(payloadB64));
  if (!valid) return null;

  let payload;
  try {
    payload = JSON.parse(decoder.decode(payloadBytes));
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days — an internal daily-use tool, not worth re-logging-in often for

/** Parses a `Cookie:` header value into {name: value} — no dependency needed for something this small. */
export function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

/** Builds a Set-Cookie value. `maxAgeSeconds` omitted (or 0) clears the cookie. Secure is skipped outside production so `vercel dev` over plain http still works. */
export function buildSetCookie(name, value, maxAgeSeconds) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  parts.push(`Max-Age=${maxAgeSeconds || 0}`);
  return parts.join("; ");
}
