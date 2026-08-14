import { useCallback, useState } from "react";
import { notifySessionExpired } from "../lib/sessionExpired.js";

/**
 * The app's first mutation primitive — every other hook (useApiData) is
 * read-only. Deliberately un-magical: no automatic cache invalidation.
 * Callers call `refresh()` on the relevant useApiData result themselves
 * after a successful mutation, consistent with the hand-rolled style already
 * used everywhere else (see src/hooks/useApiData.js).
 */
export function useApiMutation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (url, { method = "POST", body } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      // Same reasoning as useApiData: an expired session should return the
      // user to the login screen, not surface as a failed save.
      if (res.status === 401) notifySessionExpired();
      if (!res.ok) {
        const err = new Error(json.error || `Request failed (${res.status})`);
        err.status = res.status;
        err.body = json;
        throw err;
      }
      return json;
    } catch (err) {
      setError(err.message || String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
}
