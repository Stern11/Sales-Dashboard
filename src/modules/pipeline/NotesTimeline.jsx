import { useState } from "react";
import { relativeTime } from "./constants.js";
import { usePipelineMutations } from "./usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";

export function NotesTimeline({ leadId, notes, onNoteAdded }) {
  const [body, setBody] = useState("");
  const { addNote, loading, error } = usePipelineMutations();
  const { ensureName } = useNameTagContext();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    const actor = await ensureName();
    if (!actor) return;
    const { note } = await addNote(leadId, { body, author: actor });
    setBody("");
    onNoteAdded?.(note);
  }

  return (
    <div>
      <div className="notes-timeline">
        {notes.length === 0 && <p className="notes-empty">No notes yet.</p>}
        {notes.map((n) => (
          <div className="note-item" key={n.id}>
            <div className="note-item-meta">
              <span>{n.author}</span>
              <span>{relativeTime(n.created_at)}</span>
            </div>
            <div className="note-item-body">{n.body}</div>
          </div>
        ))}
      </div>
      <form className="add-note-form" onSubmit={handleSubmit}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a next-step note…" />
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || !body.trim()}>
            {loading ? "Adding…" : "Add note"}
          </button>
        </div>
      </form>
    </div>
  );
}
