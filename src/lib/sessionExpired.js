// A one-line pub/sub so the data layer can tell the auth layer "the server
// says we're not signed in any more" without importing it.
//
// The session cookie lasts 30 days, so it does expire during normal use.
// When it did, middleware.js returned 401, useApiData turned that into an
// error string, and AsyncState rendered "Couldn't load live data: Not
// authenticated." on every page — permanently. Nothing re-checked auth, so
// the app never fell back to the login screen and a reload was the only way
// out.
//
// Deliberately not a React context: useApiData is called from ~15 places and
// making it depend on AuthContext would couple every data hook to auth (and
// force every hook test to mount a provider).

const listeners = new Set();

/** Called by AuthProvider. Returns an unsubscribe function. */
export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Called by the fetch layer when a request comes back 401. */
export function notifySessionExpired() {
  for (const listener of listeners) listener();
}
