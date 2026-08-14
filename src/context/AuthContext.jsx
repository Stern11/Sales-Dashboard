import { createContext, useCallback, useContext, useEffect, useState } from "react";

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

  const logout = useCallback(async () => {
    await fetch("/api/auth?action=logout", { method: "POST" });
    setState({ loading: false, authenticated: false, name: null, email: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within an AuthProvider");
  return ctx;
}
