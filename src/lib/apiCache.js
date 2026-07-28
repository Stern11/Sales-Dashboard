// Per-URL response cache in sessionStorage — lets every module render
// last-known data instantly on mount/refresh instead of a blank spinner,
// while a fresh fetch happens in the background. sessionStorage (not
// localStorage) so a browser refresh feels instant, but data doesn't sit
// around showing genuinely stale numbers across days-apart visits.

const PREFIX = "dashboard-cache:";

export function readCache(url) {
  if (!url) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + url);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeCache(url, data) {
  if (!url) return;
  try {
    sessionStorage.setItem(PREFIX + url, JSON.stringify(data));
  } catch {
    // sessionStorage full/unavailable (e.g. private browsing) — cache is a
    // pure optimization, fine to silently skip.
  }
}
