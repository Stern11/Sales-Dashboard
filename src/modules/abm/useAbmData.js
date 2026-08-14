import { useCallback, useEffect, useRef, useState } from "react";
import { useApiData, REFRESH_MS } from "../../hooks/useApiData.js";
import { readCache, writeCache } from "../../lib/apiCache.js";

export function useSegments() {
  return useApiData("/api/segments");
}

function urlFor(segmentId) {
  return `/api/abm?segment=${encodeURIComponent(segmentId)}`;
}

/**
 * Fetches every given segment's full data in parallel (one request per
 * segment, all in flight together — no server-side aggregation endpoint).
 * The selected segment's detail view and the combined "Overall ABM Effort"
 * totals both read from this same `dataById` map, so there's exactly one
 * fetch per segment no matter how many places on the page use its data, and
 * each segment's response is cached (see useApiData) so switching the
 * segment tab back and forth doesn't re-fetch anything already in hand.
 */
export function useAllAbmData(segmentIds) {
  const key = segmentIds.join(",");
  const [dataById, setDataById] = useState(() => {
    const seeded = {};
    for (const id of segmentIds) {
      const cached = readCache(urlFor(id));
      if (cached) seeded[id] = cached;
    }
    return seeded;
  });
  const [loading, setLoading] = useState(() => segmentIds.some((id) => !readCache(urlFor(id))));
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (background) => {
      if (!segmentIds.length) return;
      const id = ++requestId.current;
      if (!background) setLoading(true);
      setError(null);
      try {
        // allSettled, not all: these are independent per-segment requests, and
        // Promise.all's fail-fast meant one segment erroring threw away every
        // other segment's data too — the user lost the whole page because one
        // of four fetches failed. Now a failed segment is simply absent, and
        // the error only surfaces if nothing at all came back.
        const results = await Promise.allSettled(
          segmentIds.map(async (segmentId) => {
            const res = await fetch(urlFor(segmentId), { cache: "no-store" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
            writeCache(urlFor(segmentId), body);
            return [segmentId, body];
          })
        );
        if (id !== requestId.current) return;

        const entries = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
        const failure = results.find((r) => r.status === "rejected");
        if (entries.length) {
          setDataById(Object.fromEntries(entries));
          setError(null);
        } else if (failure) {
          throw failure.reason;
        }
      } catch (err) {
        if (id === requestId.current) setError(err.message || String(err));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  useEffect(() => {
    if (!segmentIds.length) return;
    const seeded = {};
    for (const id of segmentIds) {
      const cached = readCache(urlFor(id));
      if (cached) seeded[id] = cached;
    }
    setDataById(seeded);
    setError(null);
    load(segmentIds.every((id) => seeded[id]));
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load]);

  return { dataById, loading, error, refresh: () => load(true) };
}
