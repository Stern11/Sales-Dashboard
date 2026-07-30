import { Overlay } from "./Overlay.jsx";

export function Drawer({ title, onClose, children }) {
  return (
    <Overlay onClose={onClose} className="overlay-drawer">
      <div className="drawer-panel" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </Overlay>
  );
}
