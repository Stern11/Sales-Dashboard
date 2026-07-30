import { Overlay } from "./Overlay.jsx";

export function Modal({ title, onClose, children, wide }) {
  return (
    <Overlay onClose={onClose} className="overlay-center">
      <div className={`modal-card ${wide ? "modal-card-wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </Overlay>
  );
}
