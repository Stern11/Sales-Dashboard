import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TEAM_DIRECTORY } from "./team.js";

// A raw email typed after "@" (e.g. "@newperson@company.com") is the escape
// hatch for tagging someone who isn't in TEAM_DIRECTORY — this just needs to
// look enough like an email to be worth offering as a suggestion; the
// backend does the real validation (see handleAddNote in
// api/pipeline/[id]/index.js, which also restricts recipients to the
// allowed sign-in domain).
const LOOKS_LIKE_EMAIL = /^\S+@\S+\.\S+$/;

// Finds the "@word" run touching the cursor, if any — must start at a word
// boundary (start of text or after whitespace) so an email pasted mid-text
// doesn't spuriously open the dropdown. The captured word can itself contain
// another "@" (mid-typed raw email), which is intentional.
export function getActiveQuery(text, cursor) {
  const uptoCursor = text.slice(0, cursor);
  const match = uptoCursor.match(/(?:^|\s)(@\S*)$/);
  if (!match) return null;
  const word = match[1];
  return { atIndex: cursor - word.length, cursor, query: word.slice(1) };
}

export function matchItems(query) {
  if (LOOKS_LIKE_EMAIL.test(query)) {
    return [{ key: query, email: query, label: `Tag ${query}` }];
  }
  const q = query.toLowerCase();
  return TEAM_DIRECTORY
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    .map((p) => ({ key: p.email, email: p.email, token: `@${p.name}`, label: `${p.name} (${p.email})` }));
}

/**
 * Plain-text @-mention tagging for a textarea — type "@", pick someone (or
 * finish typing a raw email that isn't in TEAM_DIRECTORY), and the mention
 * is inserted as literal text (e.g. "@Aryan "). `onMentionsChange` reports
 * the resolved email list, recomputed from which inserted tokens are still
 * present in the text — so deleting a mention un-tags it. Enter submits
 * (calls `onSubmit`) unless the @ dropdown is open (where it picks the
 * highlighted item) or Shift is held (inserts a newline instead).
 */
export function MentionTextarea({ value, onChange, onMentionsChange, onSubmit, placeholder }) {
  const [mentions, setMentions] = useState([]); // [{ token, email }]
  const [dropdown, setDropdown] = useState(null); // { atIndex, cursor, query, items, highlightedIndex, pos }
  const [pendingCursor, setPendingCursor] = useState(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    onMentionsChange?.([...new Set(mentions.map((m) => m.email))]);
  }, [mentions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Covers external resets (e.g. NotesTimeline clearing the body after submit).
  useEffect(() => {
    setMentions((prev) => prev.filter((m) => value.includes(m.token)));
  }, [value]);

  useEffect(() => {
    if (pendingCursor == null || !textareaRef.current) return;
    textareaRef.current.setSelectionRange(pendingCursor, pendingCursor);
    setPendingCursor(null);
  }, [value, pendingCursor]);

  useEffect(() => {
    if (!dropdown) return;
    function handleOutside(e) {
      if (dropdownRef.current?.contains(e.target) || textareaRef.current?.contains(e.target)) return;
      setDropdown(null);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dropdown]);

  function openDropdownFor(active) {
    const rect = textareaRef.current.getBoundingClientRect();
    setDropdown({
      ...active,
      items: matchItems(active.query),
      highlightedIndex: 0,
      pos: { top: rect.bottom + 4, left: rect.left, width: rect.width },
    });
  }

  function handleChange(e) {
    const newText = e.target.value;
    const cursor = e.target.selectionStart;
    onChange(newText);
    const active = getActiveQuery(newText, cursor);
    if (active) openDropdownFor(active);
    else setDropdown(null);
  }

  function selectItem(item) {
    const token = item.token || `@${item.email}`;
    const before = value.slice(0, dropdown.atIndex);
    const after = value.slice(dropdown.cursor);
    const newText = `${before}${token} ${after}`;
    onChange(newText);
    setMentions((prev) => [...prev, { token, email: item.email }]);
    setPendingCursor(before.length + token.length + 1);
    setDropdown(null);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e) {
    // While the @ dropdown is open, arrow/Enter/Tab/Escape drive it instead
    // of their usual textarea behavior.
    if (dropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdown((d) => ({ ...d, highlightedIndex: Math.min(d.highlightedIndex + 1, d.items.length - 1) }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdown((d) => ({ ...d, highlightedIndex: Math.max(d.highlightedIndex - 1, 0) }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (dropdown.items.length === 0) return;
        e.preventDefault();
        selectItem(dropdown.items[dropdown.highlightedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setDropdown(null);
        return;
      }
    }
    // Otherwise: plain Enter submits (like chat apps), Shift+Enter falls
    // through to the textarea's default newline-insertion behavior.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  }

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {dropdown && createPortal(
        <div className="mention-dropdown" ref={dropdownRef} style={{ top: dropdown.pos.top, left: dropdown.pos.left, minWidth: dropdown.pos.width }}>
          {dropdown.items.length === 0 ? (
            <div className="mention-dropdown-empty">No matches — keep typing an email to tag anyone</div>
          ) : (
            dropdown.items.map((item, i) => (
              <button
                type="button"
                key={item.key}
                className={i === dropdown.highlightedIndex ? "active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setDropdown((d) => ({ ...d, highlightedIndex: i }))}
                onClick={() => selectItem(item)}
              >
                {item.label}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </>
  );
}
