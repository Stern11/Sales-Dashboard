import { useState } from "react";
import { relativeTime } from "./constants.js";
import { usePipelineMutations } from "./usePipelineMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { MentionTextarea } from "./MentionTextarea.jsx";

// Splits a note body on "@word" runs (the same shape MentionTextarea
// inserts) and wraps them so a tagged person's name/email reads visually
// distinct from the rest of the note, rather than blending into plain text.
function renderBodyWithMentions(body) {
  const parts = body.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? <span className="mention-tag" key={i}>{part}</span> : part
  );
}

export function NotesTimeline({ leadId, notes, onNoteAdded }) {
  const [body, setBody] = useState("");
  const [taggedEmails, setTaggedEmails] = useState([]);
  const { addNote, loading, error } = usePipelineMutations();
  const { ensureName } = useNameTagContext();

  async function submitNote() {
    if (!body.trim()) return;
    const actor = await ensureName();
    if (!actor) return;
    try {
      const { note } = await addNote(leadId, { body, author: actor, tagged_emails: taggedEmails });
      setBody("");
      setTaggedEmails([]);
      onNoteAdded?.(note);
    } catch (err) {
      // Caught so a failed write isn't an unhandled promise rejection.
      // The message itself is already on screen: the mutation hook stores
      // it in `error`, which this component renders below.
      console.error("submitNote failed:", err);
    }
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    submitNote();
  }

  return (
    <div>
      <form className="add-note-form" onSubmit={handleFormSubmit}>
        <MentionTextarea
          value={body}
          onChange={setBody}
          onMentionsChange={setTaggedEmails}
          onSubmit={submitNote}
          placeholder="Assign a next step… type @ to tag someone, Enter to send, Shift+Enter for a new line"
        />
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading || !body.trim()}>
            {loading ? "Assigning…" : "Assign next step"}
          </button>
        </div>
      </form>
      <div className="notes-timeline">
        {notes.length === 0 && <p className="notes-empty">No next steps yet.</p>}
        {notes.map((n) => (
          <div className="note-item" key={n.id}>
            <div className="note-item-meta">
              <span>{n.author}</span>
              <span>{relativeTime(n.created_at)}</span>
            </div>
            <div className="note-item-body">{renderBodyWithMentions(n.body)}</div>
            {n.tagged_emails?.length > 0 && (
              <div className="note-item-tags">Tagged: {n.tagged_emails.join(", ")}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
