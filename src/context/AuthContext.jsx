import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onSessionExpired } from "../lib/sessionExpired.js";

const AuthContext = createContext(null);

/**
 * Mounted once at the app root (see App.jsx), outside/above everything else
 * — the rest of the app (including NameTagContext, which now sources its
 * "who made this edit" name from here) only ever renders once `authenticated`
 * is true, so nothing downstream needs its own auth check.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, authenticated: false, name: null, email: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      setState({ loading: false, authenticated: !!body.authenticated, name: body.name || null, email: body.email || null });
    } catch {
      setState({ loading: false, authenticated: false, name: null, email: null });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Any request coming back 401 means the cookie lapsed. Re-checking with
  // the server (rather than assuming) keeps a one-off 401 from logging
  // someone out, while a genuinely expired session resolves to
  // authenticated:false and AuthGate swaps in the login screen.
  useEffect(() => onSessionExpired(refresh), [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth?action=logout", { method: "POST" });
    setState({ loading: false, authenticated: false, name: null, email: null });
  }, []);

  // Memoized: a new object here re-renders every consumer on every render of
  // this provider, and it wraps the entire app.
  const value = useMemo(() => ({ ...state, refresh, logout }), [state, refresh, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within an AuthProvider");
  return ctx;
}
