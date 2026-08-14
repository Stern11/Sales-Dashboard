import { createContext, useCallback, useContext, useMemo } from "react";
import { useAuthContext } from "./AuthContext.jsx";

const NameTagContext = createContext(null);

/**
 * Backed by the signed-in Google account (see AuthContext.jsx) rather than a
 * locally-typed, unverified name — this used to be an honor-system prompt
 * ("what's your name?", stored in localStorage), but every write's actor is
 * now the real name on the @heizen.work account that's logged in.
 *
 * Same external shape as before ({name, ensureName}, with ensureName()
 * resolving a Promise<string>) so every existing call site — there are many,
 * across Pipeline/Demo Calls/ABM/Account Expansion — needed zero changes.
 * ensureName() always resolves immediately now (no modal, never null):
 * App.jsx never renders anything that uses this until AuthContext reports
 * authenticated:true, so a name is always already available by the time
 * this provider renders.
 */
export function NameTagProvider({ children }) {
  const { name, email } = useAuthContext();
  const actor = name || email;

  const ensureName = useCallback(() => Promise.resolve(actor), [actor]);

  // Memoized: this provider wraps the entire dashboard shell (App.jsx), and
  // ~15 components consume it just to read a name — a fresh object each
  // render re-rendered all of them for nothing.
  const value = useMemo(() => ({ name: actor, ensureName }), [actor, ensureName]);

  return (
    <NameTagContext.Provider value={value}>
      {children}
    </NameTagContext.Provider>
  );
}

export function useNameTagContext() {
  const ctx = useContext(NameTagContext);
  if (!ctx) throw new Error("useNameTagContext must be used within a NameTagProvider");
  return ctx;
}
