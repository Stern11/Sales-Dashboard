import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useNameTag } from "../hooks/useNameTag.js";
import { NameTagModal } from "../components/NameTagModal.jsx";

const NameTagContext = createContext(null);

/**
 * Mounted once at the app root (see src/App.jsx). Any pipeline mutation path
 * — creating/editing a lead, changing stage, adding a note, or "Add to
 * pipeline" from ABM/Marketing — calls `ensureName()` first: if a name is
 * already stored it resolves immediately, otherwise it opens the one-time
 * prompt and resolves once the user submits (or resolves `null` if they
 * cancel, which callers should treat as "abort the mutation").
 */
export function NameTagProvider({ children }) {
  const { name, setName } = useNameTag();
  const [promptOpen, setPromptOpen] = useState(false);
  const resolverRef = useRef(null);

  const ensureName = useCallback(() => {
    if (name) return Promise.resolve(name);
    setPromptOpen(true);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, [name]);

  function handleSubmit(value) {
    setName(value);
    setPromptOpen(false);
    resolverRef.current?.(value.trim());
    resolverRef.current = null;
  }

  function handleCancel() {
    setPromptOpen(false);
    resolverRef.current?.(null);
    resolverRef.current = null;
  }

  return (
    <NameTagContext.Provider value={{ name, ensureName }}>
      {children}
      {promptOpen && <NameTagModal onSubmit={handleSubmit} onCancel={handleCancel} />}
    </NameTagContext.Provider>
  );
}

export function useNameTagContext() {
  const ctx = useContext(NameTagContext);
  if (!ctx) throw new Error("useNameTagContext must be used within a NameTagProvider");
  return ctx;
}
