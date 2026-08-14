import { HubspotConfigError, HubspotScopeError } from "./hubspot.js";

/** 5-minute edge cache so concurrent viewers don't each trigger a fresh HubSpot call. */
export function setLiveCacheHeader(res) {
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
}

/**
 * Runs a module adapter and maps its errors to the right HTTP status —
 * missing token / missing scope get a clear, actionable message instead of a
 * raw 500, so the frontend can render them as-is.
 */
export async function withHubspotErrorHandling(res, fn) {
  try {
    const payload = await fn();
    setLiveCacheHeader(res);
    res.status(200).json({ generated_at: new Date().toISOString(), ...payload });
  } catch (err) {
    if (err instanceof HubspotConfigError) {
      res.status(500).json({ error: err.message });
    } else if (err instanceof HubspotScopeError) {
      res.status(403).json({ error: err.message, requiredScopes: err.requiredScopes });
    } else {
      // HubSpot failures carry the full upstream response body (see
      // lib/hubspot.js's non-ok branch) — useful in a log, not something to
      // forward to a browser.
      console.error("Unhandled HubSpot error:", err);
      res.status(500).json({ error: "Couldn't load live data right now. Please try again." });
    }
  }
}
