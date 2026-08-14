import { useState } from "react";
import { Modal } from "../../components/Modal.jsx";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { QUESTION_PRIORITY_OPTIONS } from "./constants.js";

const EMPTY = { question: "", expansion_area_id: "", priority: "medium", answer: "" };

/**
 * Add (no `question` prop) or edit (`question` prop) one open question — a
 * research/planning note, deliberately with no due date, assignment, or
 * task status (see the module spec: "not task management").
 */
export function QuestionModal({ accountId, question, areas, onClose, onSaved }) {
  const [values, setValues] = useState(question ? { ...EMPTY, ...question, expansion_area_id: question.expansion_area_id || "" } : EMPTY);
  const [formError, setFormError] = useState(null);
  const { addQuestion, updateQuestion, removeQuestion, loading } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();

  function patch(update) {
    setValues((v) => ({ ...v, ...update }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!values.question.trim()) {
      setFormError("Question is required.");
      return;
    }
    const actor = await ensureName();
    if (!actor) return;
    const payload = { ...values, expansion_area_id: values.expansion_area_id || null };
    try {
      if (question) {
        await updateQuestion(accountId, question.id, payload, actor);
      } else {
        await addQuestion(accountId, payload, actor);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleRemove() {
    try {
      await removeQuestion(accountId, question.id);
      onSaved();
      onClose();
    } catch (err) {
      // Caught so a failed write isn't an unhandled promise rejection.
      // The message itself is already on screen: the mutation hook stores
      // it in `error`, which this component renders below.
      console.error("handleRemove failed:", err);
    }
  }

  return (
    <Modal title={question ? "Edit open question" : "Add open question"} onClose={onClose}>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Question
          <textarea value={values.question} onChange={(e) => patch({ question: e.target.value })} placeholder="e.g. Who owns invoice exception management?" required />
        </label>
        <div className="form-row">
          <label>
            Related Expansion Area
            <select value={values.expansion_area_id || ""} onChange={(e) => patch({ expansion_area_id: e.target.value })}>
              <option value="">—</option>
              {(areas || []).filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.area}</option>)}
            </select>
          </label>
          <label>
            Priority
            <select value={values.priority} onChange={(e) => patch({ priority: e.target.value })}>
              {QUESTION_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        <label>
          Answer / Notes
          <textarea value={values.answer || ""} onChange={(e) => patch({ answer: e.target.value })} placeholder="Fill in once you know…" />
        </label>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-row-actions">
          {question ? <button type="button" className="btn btn-danger" onClick={handleRemove}>Remove</button> : <span />}
          <div className="form-actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
