// "Who is making this write?" — resolved from the signed session cookie,
// never from the request body.
//
// Every write route used to read `actor` (or `author`) straight out of
// req.body, which is what the browser's name-tag prompt happened to put
// there. That made created_by / updated_by / changed_by / note authorship
// forgeable by any authenticated caller: nothing stopped someone POSTing
// {actor: "Someone Else"} and having the audit trail record it. Since the
// app already authenticates every request with Google, the real identity was
// sitting in the cookie the whole time — it just wasn't being read.
//
// Handlers call requireActor(req) and pass the result down to the query
// layer, whose signatures are unchanged.

import { verifySession, parseCookies, SESSION_COOKIE_NAME } from "./session.js";

/** Thrown when a write is attempted without a resolvable session. Mapped to 401 by each module's respond.js. */
export class ActorError extends Error {}

/**
 * Returns the display name to attribute a write to — the session's name if
 * Google supplied one, otherwise the email, which is always present.
 *
 * Verifying the HMAC here duplicates what middleware.js already did for this
 * request. That's deliberate and cheap (one crypto.subtle.verify over a
 * ~100-byte payload): it means attribution can't be spoofed even if the
 * middleware is ever misconfigured, and it removes the need to pass identity
 * between two runtimes via headers a client could also set.
 */
export async function requireActor(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const session = await verifySession(cookies[SESSION_COOKIE_NAME], process.env.SESSION_SECRET);
  if (!session) throw new ActorError("Not authenticated.");
  return session.name || session.email;
}

/** The signed-in user's email, for routes that need the identity itself rather than a display name. */
export async function requireActorEmail(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const session = await verifySession(cookies[SESSION_COOKIE_NAME], process.env.SESSION_SECRET);
  if (!session) throw new ActorError("Not authenticated.");
  return session.email;
}
