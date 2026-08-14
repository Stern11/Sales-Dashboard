// Mirrors lib/pipeline/respond.js's shape — no DB involved here, just two
// error types worth telling apart in the response.

export class ValidationError extends Error {}
export class AuthError extends Error {}

export async function withAuthErrorHandling(res, fn) {
  try {
    const payload = await fn();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(payload);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
    } else {
      // Never echoed: the most likely unrecognized failure here is
      // requireEnv() reporting which environment variable is missing, which
      // tells an unauthenticated caller about the deployment's config.
      console.error("Unhandled auth error:", err);
      res.status(500).json({ error: "Sign-in is unavailable right now." });
    }
  }
}
