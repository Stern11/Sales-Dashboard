import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { usePipelineMutations } from "./usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

/**
 * The "security check" for delete: typing the exact company name back,
 * checked both here (so the button stays disabled until it matches) and
 * again server-side (api/pipeline/[id]/index.js) — the server check is the
 * real guard, this is just what makes it fast to see you got it right.
 */
export function DeleteLeadModal({ lead, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState(null);
  const { deleteLead, loading } = usePipelineMutations();
  const { ensureName } = useNameTagContext();

  const matches = confirmText.trim().length > 0 && confirmText.trim() === lead.company_name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!matches) return;
    setError(null);
    const actor = await ensureName();
    if (!actor) return;
    try {
      await deleteLead(lead.id, { confirm_company_name: confirmText.trim(), actor });
      onDeleted?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Delete this lead?" onClose={onClose}>
      <p className="subtitle" style={{ marginBottom: 6 }}>
        This permanently deletes <strong>{lead.company_name}</strong> — including all its notes and
        stage history. This can't be undone.
      </p>
      <p className="subtitle" style={{ marginBottom: 14 }}>
        Type <strong>{lead.company_name}</strong> below to confirm.
      </p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Company name
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            placeholder={lead.company_name}
            autoComplete="off"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger-solid" disabled={!matches || loading}>
            {loading ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
