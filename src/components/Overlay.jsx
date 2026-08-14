import { useEffect } from "react";

/**
 * Shared backdrop + escape-key/click-outside close logic for Modal and
 * Drawer — neither component exists elsewhere to inherit this from, so it's
 * factored out once rather than duplicated in both.
 */
// Every mounted Overlay used to bind its own document-level Escape handler,
// so one keypress fired all of them. The drawers render their confirm modals
// *inside* the drawer (see LeadDetailDrawer / DemoCallLeadDrawer), so
// pressing Escape in "are you sure?" dismissed the modal and the drawer
// underneath it in the same keystroke — losing the user's place entirely.
//
// A module-level stack fixes that: only the most recently mounted overlay
// responds. It lives outside the component because that's exactly the
// question being answered — "am I the topmost overlay on the page?" — which
// no single instance can know on its own.
const overlayStack = [];

export function Overlay({ onClose, children, className = "" }) {
  useEffect(() => {
    const token = {};
    overlayStack.push(token);
    function handleKey(e) {
      if (e.key !== "Escape") return;
      if (overlayStack[overlayStack.length - 1] !== token) return;
      onClose?.();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      const i = overlayStack.indexOf(token);
      if (i !== -1) overlayStack.splice(i, 1);
    };
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
