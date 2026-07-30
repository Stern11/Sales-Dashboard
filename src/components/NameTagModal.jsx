import { useState } from "react";
import { Modal } from "./Modal.jsx";

/** One-time prompt gating any pipeline write — see src/context/NameTagContext.jsx. */
export function NameTagModal({ onSubmit, onCancel }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
  }

  return (
    <Modal title="What's your name?" onClose={onCancel}>
      <p className="subtitle" style={{ marginBottom: 14 }}>
        Shown on pipeline edits and notes you make — stored only in this browser, not a login.
      </p>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Your name
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Jatin"
          />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary">Continue</button>
        </div>
      </form>
    </Modal>
  );
}
