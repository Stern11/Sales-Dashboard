import { useState } from "react";
import { signalTypeLabel, formatShortDate } from "./constants.js";
import { SignalModal } from "./SignalModal.jsx";

function areaNameFor(areas, id) {
  return (areas || []).find((a) => a.id === id)?.area;
}

/** Chronological (newest first, already sorted by the API) research feed. */
export function SignalsSection({ accountId, signals, areas, onChanged }) {
  const [modalTarget, setModalTarget] = useState(null); // null closed, {} = add, signal = edit

  return (
    <div className="lead-detail-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>What's Happening / Research Signals</h4>
        <button type="button" className="btn btn-primary" onClick={() => setModalTarget({})}>+ Add signal</button>
      </div>
      {(!signals || signals.length === 0) ? (
        <p className="notes-empty">No research signals logged yet.</p>
      ) : (
        <div className="notes-timeline">
          {signals.map((s) => (
            <div key={s.id} className="note-item" style={{ cursor: "pointer" }} onClick={() => setModalTarget(s)}>
              <div className="note-item-meta">
                <span><strong style={{ color: "var(--text-primary)" }}>{formatShortDate(s.signal_date)}</strong> · {signalTypeLabel(s.signal_type)}</span>
                {s.source_url && <a className="li-link" href={s.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Source ↗</a>}
              </div>
              <div className="note-item-body">{s.finding}</div>
              {areaNameFor(areas, s.expansion_area_id) && (
                <div className="note-item-tags">Relevant to: {areaNameFor(areas, s.expansion_area_id)}</div>
              )}
              {s.notes && <div className="note-item-body" style={{ marginTop: 6, color: "var(--text-secondary)" }}>{s.notes}</div>}
            </div>
          ))}
        </div>
      )}
      {modalTarget && (
        <SignalModal
          accountId={accountId}
          signal={modalTarget.id ? modalTarget : null}
          areas={areas}
          onClose={() => setModalTarget(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
