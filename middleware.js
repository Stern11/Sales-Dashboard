// Gates every /api/* route behind a valid session cookie — this is what
// actually enforces "only signed-in @heizen.work accounts can use the app",
// not api/auth/index.js (that file only issues/clears the cookie and
// reports its status). Runs as Vercel Edge Middleware, which is a distinct
// primitive from a serverless function — it doesn't count against Vercel
// Hobby's 12-function cap, and it means every one of those 11 functions
// gets this check for free instead of each importing and calling it
// individually.
//
// /api/auth itself is exempt (checked by path, not matcher, so the exemption
// is visible in one place): the login/logout/status endpoints have to be
// reachable before a session cookie exists.

import { verifySession, parseCookies, SESSION_COOKIE_NAME } from "./lib/auth/session.js";

export const config = {
  matcher: ["/api/:path*"],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/auth")) return;

  const cookies = parseCookies(request.headers.get("cookie"));
  const session = await verifySession(cookies[SESSION_COOKIE_NAME], process.env.SESSION_SECRET || "");
  if (!session) {
    return new Response(JSON.stringify({ error: "Not authenticated." }), {
      status: 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  // No return value — Vercel Edge Middleware treats `undefined` as "let the
  // request continue to its normal destination" (there's no NextResponse
  // here; that helper is Next.js-specific and this isn't a Next.js app).
}
