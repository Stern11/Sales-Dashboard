import { useState } from "react";
import { StatusPill } from "../../components/StatusPill.jsx";
import { whitespaceStatusMeta } from "./constants.js";
import { WhitespaceModal } from "./WhitespaceModal.jsx";

/** Lightweight chip grid — where Heizen currently operates vs. adjacent areas. Deliberately not a matrix. */
export function WhitespaceSection({ accountId, whitespace, onChanged }) {
  const [modalTarget, setModalTarget] = useState(null); // null closed, {} = add, row = edit

  return (
    <div className="lead-detail-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Account Whitespace</h4>
        <button type="button" className="btn" onClick={() => setModalTarget({})}>+ Add area</button>
      </div>
      {(!whitespace || whitespace.length === 0) ? (
        <p className="notes-empty">No whitespace mapped yet — add the areas worth tracking for this account.</p>
      ) : (
        <div className="chip-row">
          {whitespace.map((row) => (
            <button type="button" key={row.id} className="chip-button" onClick={() => setModalTarget(row)}>
              {row.area}
              <StatusPill variant={whitespaceStatusMeta(row.status).pillVariant}>{whitespaceStatusMeta(row.status).label}</StatusPill>
            </button>
          ))}
        </div>
      )}
      {modalTarget && (
        <WhitespaceModal
          accountId={accountId}
          row={modalTarget.id ? modalTarget : null}
          onClose={() => setModalTarget(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
