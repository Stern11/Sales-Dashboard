import { useCallback, useEffect, useState } from "react";
import { readCache, writeCache } from "../lib/apiCache.js";
import { notifySessionExpired } from "../lib/sessionExpired.js";

export const REFRESH_MS = 5 * 60 * 1000; // auto re-fetch every 5 minutes while the tab is open

/**
 * One shared record per URL, so N components asking for the same data make
 * one request between them instead of N.
 *
 * Each useApiData() call used to own its fetch, its cache reads and its
 * 5-minute interval. Nothing deduplicated them, so `/api/pipeline` was
 * fetched by three unrelated components (PipelinePage, OverviewPage,
 * LinkExistingPipelineLeadPanel) and `/api/demo-calls` by two — each with
 * its own poll. Worst of all, opening the Meetings page mounted
 * useLiveDemoCallContacts, which pulls `/api/sources?period=lifetime` — a
 * sequential scan of every contact in the portal, documented at
 * api/sources/index.js as ~10-12s — and visiting ABM Outreach next paid for
 * the whole thing again under a second hook instance.
 *
 * Entries are kept after their last subscriber leaves so navigating back to
 * a page paints from memory; sessionStorage remains the cross-reload cache.
 */
const entries = new Map();

function getEntry(url) {
  let entry = entries.get(url);
  if (!entry) {
    entry = {
      url,
      subscribers: new Set(),
      // Read once, here, rather than on every render of every consumer —
      // this used to be three synchronous JSON.parse calls of a potentially
      // large payload per mount, on the render path.
      data: readCache(url),
      error: null,
      loading: readCache(url) == null,
      inFlight: null,
      timer: null,
      lastLoadedAt: 0,
    };
    entries.set(url, entry);
  }
  return entry;
}

function emit(entry) {
  const snapshot = { data: entry.data, loading: entry.loading, error: entry.error };
  for (const listener of entry.subscribers) listener(snapshot);
}

/**
 * Fetches an entry's URL, at most once at a time.
 *
 * `background` means "something is already on screen": a failure then leaves
 * the stale data visible rather than replacing it with an error, since the
 * user is mid-task and the previous numbers are still broadly true.
 */
function load(entry, background) {
  // Joining an in-flight request is what makes two components mounting in
  // the same tick share one round trip, and it also absorbs React
  // StrictMode's deliberate double-effect in development.
  if (entry.inFlight) return entry.inFlight;

  if (!background) {
    entry.loading = true;
    emit(entry);
  }

  const promise = (async () => {
    try {
      const res = await fetch(entry.url, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      // A 401 means the session cookie expired mid-session. Surfacing it as
      // a generic error would leave "Not authenticated." on screen forever;
      // this sends the app back to the login screen instead.
      if (res.status === 401) {
        notifySessionExpired();
        return;
      }
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
      entry.data = body;
      entry.error = null;
      entry.lastLoadedAt = Date.now();
      writeCache(entry.url, body);
    } catch (err) {
      if (!background || entry.data == null) entry.error = err.message || String(err);
    } finally {
      entry.loading = false;
      entry.inFlight = null;
      emit(entry);
    }
  })();

  entry.inFlight = promise;
  return promise;
}

function startPolling(entry) {
  if (entry.timer) return;
  entry.timer = setInterval(() => {
    // A backgrounded tab kept re-running every poll — including the ~10s
    // full-portal HubSpot scan — against data nobody was looking at, burning
    // a rate limit shared across the whole HubSpot account. The
    // visibilitychange handler below catches up when the tab returns.
    if (document.hidden) return;
    load(entry, true);
  }, REFRESH_MS);
}

function stopPolling(entry) {
  if (!entry.timer) return;
  clearInterval(entry.timer);
  entry.timer = null;
}

// One listener for the whole app rather than one per hook instance. On
// becoming visible again, any entry whose data has gone stale while the tab
// was hidden revalidates immediately, so you don't stare at old numbers
// waiting for the next tick.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    for (const entry of entries.values()) {
      if (entry.subscribers.size === 0) continue;
      if (Date.now() - entry.lastLoadedAt >= REFRESH_MS) load(entry, true);
    }
  });
}

const IDLE = { data: null, loading: false, error: null };

/**
 * Fetches `url`, exposes {data, loading, error, refresh}, and auto-refreshes
 * on an interval. A null/undefined `url` skips the fetch (e.g. while a
 * required param like a segment id isn't resolved yet).
 *
 * Stale-while-revalidate: if a previous response for this exact `url` is
 * known — from another component currently using it, or from sessionStorage
 * on a fresh load — it's shown immediately, so `loading` means "nothing to
 * show yet", not "a fetch is in flight". A background refetch always
 * happens, so what's on screen self-corrects once it resolves.
 */
export function useApiData(url) {
  const [state, setState] = useState(() => {
    if (!url) return IDLE;
    const entry = getEntry(url);
    return { data: entry.data, loading: entry.loading, error: entry.error };
  });

  useEffect(() => {
    if (!url) {
      setState(IDLE);
      return;
    }
    const entry = getEntry(url);
    const listener = (snapshot) => setState(snapshot);
    entry.subscribers.add(listener);
    setState({ data: entry.data, loading: entry.loading, error: entry.error });

    startPolling(entry);
    load(entry, entry.data != null); // known data: revalidate silently. otherwise: show the loading state.

    return () => {
      entry.subscribers.delete(listener);
      if (entry.subscribers.size === 0) stopPolling(entry);
    };
  }, [url]);

  // Stable across renders. It used to be a fresh arrow every render, which
  // meant every `onRefresh` prop changed identity every render and defeated
  // memoization in whatever received it.
  const refresh = useCallback(() => {
    if (!url) return undefined;
    return load(getEntry(url), true);
  }, [url]);

  return { data: state.data, loading: state.loading, error: state.error, refresh };
}

/**
 * The registry internals, exported for tests only.
 *
 * This project has no jsdom or Testing Library (vitest.config.js runs in the
 * `node` environment), so the hook itself can't be rendered in a test. The
 * behavior worth pinning down — one request shared between subscribers, a
 * failed background revalidation leaving data on screen, polling pausing on
 * a hidden tab — lives in these functions rather than in the React binding,
 * so testing them directly covers the substance rather than the wiring.
 */
export const __test = { entries, getEntry, load, startPolling, stopPolling };
