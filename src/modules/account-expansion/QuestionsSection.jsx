import { useState } from "react";
import { StatusPill } from "../../components/StatusPill.jsx";
import { questionPriorityMeta } from "./constants.js";
import { QuestionModal } from "./QuestionModal.jsx";

function areaNameFor(areas, id) {
  return (areas || []).find((a) => a.id === id)?.area;
}

/** Things still to learn — a research/planning list, not a task tracker (no due dates/assignments/status). */
export function QuestionsSection({ accountId, questions, areas, onChanged }) {
  const [modalTarget, setModalTarget] = useState(null); // null closed, {} = add, question = edit

  return (
    <div className="lead-detail-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>Open Questions</h4>
        <button type="button" className="btn btn-primary" onClick={() => setModalTarget({})}>+ Add question</button>
      </div>
      {(!questions || questions.length === 0) ? (
        <p className="notes-empty">No open questions yet.</p>
      ) : (
        <div className="notes-timeline">
          {questions.map((q) => (
            <div key={q.id} className="note-item" style={{ cursor: "pointer" }} onClick={() => setModalTarget(q)}>
              <div className="note-item-meta">
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <StatusPill variant={questionPriorityMeta(q.priority).pillVariant}>{questionPriorityMeta(q.priority).label}</StatusPill>
                  {areaNameFor(areas, q.expansion_area_id) && <span>{areaNameFor(areas, q.expansion_area_id)}</span>}
                </span>
              </div>
              <div className="note-item-body" style={{ fontWeight: 600 }}>{q.question}</div>
              {q.answer ? (
                <div className="note-item-body" style={{ marginTop: 6, color: "var(--text-secondary)" }}>{q.answer}</div>
              ) : (
                <p className="notes-empty" style={{ marginTop: 6 }}>Not answered yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
      {modalTarget && (
        <QuestionModal
          accountId={accountId}
          question={modalTarget.id ? modalTarget : null}
          areas={areas}
          onClose={() => setModalTarget(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
