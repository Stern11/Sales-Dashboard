import { useCallback, useState } from "react";

const STORAGE_KEY = "dashboard-name-tag";

/**
 * Honor-system identity for attributing pipeline edits/notes — not real
 * auth, just a name remembered in this browser. Same localStorage pattern
 * as useTheme.js.
 */
export function useNameTag() {
  const [name, setNameState] = useState(() => localStorage.getItem(STORAGE_KEY) || "");

  const setName = useCallback((value) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNameState(trimmed);
  }, []);

  return { name, setName };
}
