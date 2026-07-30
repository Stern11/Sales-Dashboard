import { useEffect } from "react";

/**
 * Shared backdrop + escape-key/click-outside close logic for Modal and
 * Drawer — neither component exists elsewhere to inherit this from, so it's
 * factored out once rather than duplicated in both.
 */
export function Overlay({ onClose, children, className = "" }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className={`overlay-backdrop ${className}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {children}
    </div>
  );
}
