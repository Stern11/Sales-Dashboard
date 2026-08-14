import { useCallback, useEffect, useRef, useState } from "react";
import { readCache, writeCache } from "../lib/apiCache.js";
import { notifySessionExpired } from "../lib/sessionExpired.js";

export const REFRESH_MS = 5 * 60 * 1000; // auto re-fetch every 5 minutes while the tab is open

/**
 * Fetches `url`, exposes {data, loading, error, refresh}, and auto-refreshes
 * on an interval. `url` returning null/undefined skips the fetch (e.g. while
 * a required param like a segment id isn't resolved yet).
 *
 * Stale-while-revalidate: if a previous response for this exact `url` is
 * cached (sessionStorage), it's shown immediately — `loading` only reflects
 * "nothing to show yet", not "a fetch is in flight". A background refetch
 * always happens regardless, so the on-screen data self-corrects once it
 * resolves. This is what makes a browser refresh feel instant instead of
 * re-paying the full HubSpot round-trip every time.
 */
export function useApiData(url) {
  const [data, setData] = useState(() => readCache(url));
  const [loading, setLoading] = useState(() => !readCache(url));
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async (background) => {
    if (!url) return;
    const id = ++requestId.current;
    if (!background) setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      // A 401 means the session cookie expired mid-session. Surfacing it as
      // a generic error would leave "Not authenticated." on screen forever;
      // this sends the app back to the login screen instead.
      if (res.status === 401) {
        notifySessionExpired();
        return;
      }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      if (id === requestId.current) {
        setData(body);
        writeCache(url, body);
      }
    } catch (err) {
      // A background revalidation failing shouldn't blank out data that's
      // already on screen — only surface the error if we have nothing to show.
      if (id === requestId.current && (!background || !readCache(url))) {
        setError(err.message || String(err));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const cached = readCache(url);
    setData(cached);
    setError(null);
    load(!!cached); // cached: revalidate silently. uncached: show the loading state.
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [url, load]);

  return { data, loading, error, refresh: () => load(true) };
}
