// Google login, restricted to @heizen.work accounts.
//
//   GET    /api/auth                 — current session status ({authenticated, name, email} or {authenticated: false})
//   POST   /api/auth?action=login    — body {credential}: a Google ID token from Google Identity
//                                       Services' Sign In With Google button. Verified server-side
//                                       (signature + audience + issuer, via google-auth-library —
//                                       not something worth hand-rolling), then domain-checked.
//                                       On success, sets a signed session cookie.
//   POST   /api/auth?action=logout   — clears the session cookie.
//
// middleware.js (repo root) is what actually gates every other /api/* route
// using this same session cookie — this file only handles establishing and
// tearing down that cookie, and reporting its current state.

import { OAuth2Client } from "google-auth-library";
import { withAuthErrorHandling, ValidationError, AuthError } from "../../lib/auth/respond.js";
import { signSession, verifySession, parseCookies, buildSetCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../../lib/auth/session.js";
import { isAllowedEmail, ALLOWED_EMAIL_DOMAIN } from "../../lib/auth/constants.js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

async function handleStatus(req, res) {
  await withAuthErrorHandling(res, async () => {
    const cookies = parseCookies(req.headers.cookie);
    const session = await verifySession(cookies[SESSION_COOKIE_NAME], process.env.SESSION_SECRET || "");
    if (!session) return { authenticated: false };
    return { authenticated: true, name: session.name, email: session.email };
  });
}

async function handleLogin(req, res) {
  await withAuthErrorHandling(res, async () => {
    const credential = req.body?.credential;
    if (!credential || typeof credential !== "string") throw new ValidationError("credential is required.");

    const clientId = requireEnv("VITE_GOOGLE_CLIENT_ID");
    const sessionSecret = requireEnv("SESSION_SECRET");

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch (err) {
      throw new AuthError("Google sign-in couldn't be verified.");
    }

    if (!payload?.email_verified) throw new AuthError("Google account email isn't verified.");
    if (!isAllowedEmail(payload.email)) throw new AuthError(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in.`);

    const session = { email: payload.email.toLowerCase(), name: payload.name || payload.email };
    const token = await signSession(session, sessionSecret, SESSION_MAX_AGE_SECONDS);
    res.setHeader("Set-Cookie", buildSetCookie(SESSION_COOKIE_NAME, token, SESSION_MAX_AGE_SECONDS));
    return { authenticated: true, ...session };
  });
}

async function handleLogout(req, res) {
  await withAuthErrorHandling(res, async () => {
    res.setHeader("Set-Cookie", buildSetCookie(SESSION_COOKIE_NAME, "", 0));
    return { authenticated: false };
  });
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method === "GET") return handleStatus(req, res);

  if (req.method === "POST") {
    if (action === "login") return handleLogin(req, res);
    if (action === "logout") return handleLogout(req, res);
    res.status(400).json({ error: "Missing or unrecognized ?action=." });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
