import { useMemo, useState } from "react";
import { EMPTY_ARRAY } from "../../lib/empty.js";
import { usePipelineList } from "../pipeline/usePipelineData.js";
import { stageMeta } from "../pipeline/constants.js";

/**
 * Search-and-link picker for the case "Add to pipeline" can't auto-detect on
 * its own: two records for the same real-world lead that share no key
 * (neither a common hubspot_contact_id, since one or both were entered by
 * hand) — see DemoCallLeadDrawer.jsx's handleAddToPipeline, which already
 * auto-links when there IS a shared hubspot_contact_id. Only fetches the
 * pipeline list once actually mounted (this panel is opt-in, collapsed by
 * default), and only filters once the rep's typed something — the full
 * pipeline list is never dumped on screen unfiltered.
 */
export function LinkExistingPipelineLeadPanel({ onLink, linking }) {
  const { data, loading } = usePipelineList();
  const [query, setQuery] = useState("");
  const leads = data?.leads ?? EMPTY_ARRAY;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return leads
      .filter((l) => l.company_name.toLowerCase().includes(q) || l.contact_name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [leads, query]);

  return (
    <div style={{ marginTop: 10 }}>
      <input
        type="search"
        placeholder="Search pipeline leads by company or contact…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <p className="subtitle" style={{ marginTop: 8 }}>Loading pipeline leads…</p>}
      {query.trim() && !loading && matches.length === 0 && (
        <p className="subtitle" style={{ marginTop: 8 }}>No matching pipeline leads.</p>
      )}
      {matches.length > 0 && (
        <div className="notes-timeline" style={{ marginTop: 8 }}>
          {matches.map((l) => (
            <div key={l.id} className="note-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div className="note-item-body" style={{ fontWeight: 600 }}>{l.company_name}</div>
                <div className="note-item-meta"><span>{l.contact_name} · {stageMeta(l.stage).label}</span></div>
              </div>
              <button type="button" className="btn" onClick={() => onLink(l)} disabled={linking}>
                {linking ? "Linking…" : "Link"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
