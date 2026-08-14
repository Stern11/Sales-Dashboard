import { useCallback, useState } from "react";

const STORAGE_KEY = "dashboard-sidebar-collapsed";

/** Persisted collapse state for the module sidebar — mirrors useTheme.js's localStorage pattern. Defaults to expanded. */
export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
