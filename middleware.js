// Gates every /api/* route behind a valid session cookie — this is what
// actually enforces "only signed-in @heizen.work accounts can use the app",
// not api/auth/index.js (that file only issues/clears the cookie and
// reports its status). Runs as Vercel Edge Middleware, which is a distinct
// primitive from a serverless function — it doesn't count against Vercel
// Hobby's 12-function cap, and it means every one of those 11 functions
// gets this check for free instead of each importing and calling it
// individually.
//
// This is the gate, but deliberately not the only check: handlers that write
// re-verify the same cookie themselves to learn *who* is writing (see
// requireActor in lib/auth/actor.js). That keeps attribution trustworthy
// even on a deployment where this middleware somehow doesn't attach.
//
// /api/auth itself is exempt (checked by path, not matcher, so the exemption
// is visible in one place): the login/logout/status endpoints have to be
// reachable before a session cookie exists.

import { verifySession, parseCookies, SESSION_COOKIE_NAME } from "./lib/auth/session.js";
import { isAllowedEmail } from "./lib/auth/constants.js";

export const config = {
  matcher: ["/api/:path*"],
};

function unauthorized() {
  return new Response(JSON.stringify({ error: "Not authenticated." }), {
    status: 401,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);

  // Segment match, not a bare startsWith: `/api/authz` or `/api/auth-debug`
  // would otherwise inherit this exemption silently just by being named
  // adjacently, which is exactly the kind of thing nobody notices adding.
  if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) return;

  const cookies = parseCookies(request.headers.get("cookie"));
  const session = await verifySession(cookies[SESSION_COOKIE_NAME], process.env.SESSION_SECRET);
  if (!session) return unauthorized();

  // The cookie lasts 30 days and there is no server-side session store to
  // revoke against, so re-check the domain rule on every request rather than
  // trusting that it held whenever the cookie was minted. An account that
  // loses access shouldn't keep it until the cookie happens to expire.
  if (!isAllowedEmail(session.email)) return unauthorized();

  // No return value — Vercel Edge Middleware treats `undefined` as "let the
  // request continue to its normal destination" (there's no NextResponse
  // here; that helper is Next.js-specific and this isn't a Next.js app).
}
