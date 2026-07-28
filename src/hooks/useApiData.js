import { useCallback, useEffect, useRef, useState } from "react";

const REFRESH_MS = 5 * 60 * 1000; // auto re-fetch every 5 minutes while the tab is open

/**
 * Fetches `url`, exposes {data, loading, error, refresh}, and auto-refreshes
 * on an interval. `url` returning null/undefined skips the fetch (e.g. while
 * a required param like a segment id isn't resolved yet).
 */
export function useApiData(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      if (id === requestId.current) setData(body);
    } catch (err) {
      if (id === requestId.current) setError(err.message || String(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { data, loading, error, refresh: load };
}
