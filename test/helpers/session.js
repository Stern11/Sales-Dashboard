// Builds the signed session cookie that API route tests need now that write
// handlers resolve the actor from the session rather than the request body
// (see lib/auth/actor.js).
//
// Sets SESSION_SECRET on import: verifySession fails closed on a missing
// secret, so without this every authed test would 401 for the wrong reason
// and the tests would still pass for tests that only assert 401.

import { signSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "../../lib/auth/session.js";

export const TEST_SESSION_SECRET = "test-session-secret";
export const TEST_ACTOR_EMAIL = "aryan@heizen.work";
export const TEST_ACTOR_NAME = "Aryan";

process.env.SESSION_SECRET = TEST_SESSION_SECRET;

/** A `Cookie:` header value carrying a valid session for TEST_ACTOR_NAME. */
export async function sessionCookie({ email = TEST_ACTOR_EMAIL, name = TEST_ACTOR_NAME, secret = TEST_SESSION_SECRET } = {}) {
  const token = await signSession({ email, name }, secret, SESSION_MAX_AGE_SECONDS);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
}
