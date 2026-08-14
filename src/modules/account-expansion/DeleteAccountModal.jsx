import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";

/** Mirrors src/modules/demo-calls/DeleteDemoCallLeadModal.jsx's type-to-confirm gate. */
export function DeleteAccountModal({ account, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState(null);
  const { deleteAccount, loading } = useAccountExpansionMutations();

  const matches = confirmText.trim().length > 0 && confirmText.trim() === account.company_name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!matches) return;
    setError(null);
    try {
      await deleteAccount(account.id, confirmText.trim());
      onDeleted();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal title="Delete this account?" onClose={onClose}>
      <p className="subtitle" style={{ marginBottom: 6 }}>
        This permanently deletes <strong>{account.company_name}</strong> — including every expansion
        area, whitespace entry, research signal, stakeholder, and open question tracked for it. This can't be undone.
      </p>
      <p className="subtitle" style={{ marginBottom: 14 }}>
        Type <strong>{account.company_name}</strong> below to confirm.
      </p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Company name
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            placeholder={account.company_name}
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
