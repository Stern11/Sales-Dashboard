import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AsyncState } from "../../components/AsyncState.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { useAccountExpansionDetail } from "./useAccountExpansionData.js";
import { useAccountExpansionMutations } from "./useAccountExpansionMutations.js";
import { useNameTagContext } from "../../context/NameTagContext.jsx";
import { EXPANSION_OUTLOOK_OPTIONS, outlookMeta, formatShortDate } from "./constants.js";
import { ExpansionAreasSection } from "./ExpansionAreasSection.jsx";
import { WhitespaceSection } from "./WhitespaceSection.jsx";
import { SignalsSection } from "./SignalsSection.jsx";
import { StakeholdersSection } from "./StakeholdersSection.jsx";
import { QuestionsSection } from "./QuestionsSection.jsx";
import { DeleteAccountModal } from "./DeleteAccountModal.jsx";

/**
 * One account's full planning workspace — a real page (its own route), not a
 * drawer. Split into 3 tabs instead of one long scroll, each pairing
 * sections that answer the same planning question: where we stand today
 * (Footprint + Whitespace), where we could grow and with whom (Expansion
 * Areas + Stakeholders), and what's still open (Research Signals +
 * Questions). The Summary strip stays visible above the tabs regardless of
 * which one is active, so the account's headline state is never a tab away.
 *
 * The account is expected to already exist by the time this route is
 * reached (created via AddAccountModal on the portfolio page), so this just
 * fetches its detail directly — no get-or-create bootstrap.
 */
const TABS = [
  { value: "footprint", label: "Footprint & Whitespace" },
  { value: "growth", label: "Expansion Plan" },
  { value: "research", label: "Research & Questions" },
];

export function AccountDetailPage() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useAccountExpansionDetail(accountId);
  const { updateFootprint, loading: saving } = useAccountExpansionMutations();
  const { ensureName } = useNameTagContext();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tab, setTab] = useState("footprint");
  const [editingFootprint, setEditingFootprint] = useState(false);

  const [footprintValues, setFootprintValues] = useState(null);
  useEffect(() => {
    if (data?.account) setFootprintValues(data.account);
  }, [data?.account]);

  const [saveError, setSaveError] = useState(null);
  const isDirty = !!(footprintValues && data?.account && JSON.stringify(footprintValues) !== JSON.stringify(data.account));

  async function handleSaveFootprint(e) {
    e.preventDefault();
    setSaveError(null);
    const actor = await ensureName();
    if (!actor) return;
    try {
      await updateFootprint(accountId, {
        expansion_outlook: footprintValues.expansion_outlook || null,
        footprint_use_case: footprintValues.footprint_use_case,
        footprint_function: footprintValues.footprint_function,
        footprint_geography: footprintValues.footprint_geography,
        footprint_value: footprintValues.footprint_value === "" ? null : footprintValues.footprint_value,
        footprint_start_date: footprintValues.footprint_start_date,
        footprint_stakeholder: footprintValues.footprint_stakeholder,
        footprint_notes: footprintValues.footprint_notes,
      }, actor);
      refresh();
      setEditingFootprint(false);
    } catch (err) {
      setSaveError(err.message);
    }
  }

  function patch(update) {
    setFootprintValues((v) => ({ ...v, ...update }));
  }

  function cancelEditFootprint() {
    setFootprintValues(data.account);
    setSaveError(null);
    setEditingFootprint(false);
  }

  if (error) {
    return (
      <div>
        <p className="error">Couldn't load this account: {error}</p>
        <Link className="expansion-back-link" to="/expansion">← Back to Accounts</Link>
      </div>
    );
  }

  const account = data?.account;
  const areas = data?.areas || [];
  const activeAreas = areas.filter((a) => !a.archived);
  const topAreas = activeAreas.slice(0, 3);
  const latestSignal = (data?.signals || [])[0]; // already newest-first from the API
  const openQuestions = (data?.questions || []).filter((q) => !q.answer);

  // Counts on the tab pills — lets a rep tell "nothing here yet" from
  // "there's work waiting" without opening the tab.
  const tabsWithCounts = TABS.map((t) => {
    const count =
      t.value === "footprint" ? (data?.whitespace || []).length :
      t.value === "growth" ? activeAreas.length + (data?.stakeholders || []).length :
      (data?.signals || []).length + openQuestions.length;
    return { ...t, label: count > 0 ? `${t.label} (${count})` : t.label };
  });

  return (
    <div className="expansion-detail-page">
      <AsyncState loading={loading && !data}>
        {!account ? (
          <div>
            <p className="empty">No account found with that id.</p>
            <Link className="expansion-back-link" to="/expansion">← Back to Accounts</Link>
          </div>
        ) : (
          <>
            <Link className="expansion-back-link" to="/expansion">← Back to Accounts</Link>
            <h2 className="expansion-account-title">{account.company_name}</h2>

            {/* Summary strip — stays visible no matter which tab is open */}
            <div className="expansion-summary-grid">
              <div>
                <div className="expansion-summary-label">Current Footprint</div>
                <div className="expansion-summary-value">{account.footprint_use_case || "Not documented yet"}</div>
              </div>
              <div>
                <div className="expansion-summary-label">Expansion Outlook</div>
                <div><StatusPill variant={outlookMeta(account.expansion_outlook).pillVariant}>{outlookMeta(account.expansion_outlook).label}</StatusPill></div>
              </div>
              <div>
                <div className="expansion-summary-label">Top Expansion Areas</div>
                <div className="chip-row">
                  {topAreas.length
                    ? topAreas.map((a) => <span key={a.id} className="pill pill-stage">{a.area}</span>)
                    : <span className="expansion-summary-value">None yet</span>}
                </div>
              </div>
              <div>
                <div className="expansion-summary-label">Latest Signal</div>
                <div className="expansion-summary-value">{latestSignal ? `${formatShortDate(latestSignal.signal_date)} · ${latestSignal.finding}` : "None yet"}</div>
              </div>
              <div>
                <div className="expansion-summary-label">Last Researched</div>
                <div className="expansion-summary-value">{account.last_researched_at ? new Date(account.last_researched_at).toLocaleDateString() : "Never"}</div>
              </div>
              <div>
                <div className="expansion-summary-label">Last Updated</div>
                <div className="expansion-summary-value">{new Date(account.updated_at).toLocaleDateString()}</div>
              </div>
            </div>

            <PeriodToggle options={tabsWithCounts} value={tab} onChange={setTab} />

            {tab === "footprint" && (
              <div className="expansion-tab-panel">
                <div className="lead-detail-section">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editingFootprint ? 10 : 0 }}>
                    <h4 style={{ margin: 0 }}>Current Heizen Footprint</h4>
                    {!editingFootprint && (
                      <button type="button" className="btn" onClick={() => setEditingFootprint(true)}>Edit</button>
                    )}
                  </div>
                  {editingFootprint ? (
                    <form className="form-grid" onSubmit={handleSaveFootprint}>
                      <label>
                        Expansion Outlook
                        <select value={footprintValues?.expansion_outlook || ""} onChange={(e) => patch({ expansion_outlook: e.target.value })}>
                          <option value="">— Not set —</option>
                          {EXPANSION_OUTLOOK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </label>
                      <div className="form-row">
                        <label>
                          Current use case / workflow
                          <input type="text" value={footprintValues?.footprint_use_case || ""} onChange={(e) => patch({ footprint_use_case: e.target.value })} />
                        </label>
                        <label>
                          Function
                          <input type="text" value={footprintValues?.footprint_function || ""} onChange={(e) => patch({ footprint_function: e.target.value })} />
                        </label>
                      </div>
                      <div className="form-row">
                        <label>
                          Business unit / geography
                          <input type="text" value={footprintValues?.footprint_geography || ""} onChange={(e) => patch({ footprint_geography: e.target.value })} />
                        </label>
                        <label>
                          Current commercial value ($)
                          <input type="number" min="0" step="1" value={footprintValues?.footprint_value ?? ""} onChange={(e) => patch({ footprint_value: e.target.value })} />
                        </label>
                      </div>
                      <div className="form-row">
                        <label>
                          Start date
                          <input type="date" value={footprintValues?.footprint_start_date || ""} onChange={(e) => patch({ footprint_start_date: e.target.value })} />
                        </label>
                        <label>
                          Key stakeholder
                          <input type="text" value={footprintValues?.footprint_stakeholder || ""} onChange={(e) => patch({ footprint_stakeholder: e.target.value })} />
                        </label>
                      </div>
                      <label>
                        Notes on what Heizen currently does
                        <textarea value={footprintValues?.footprint_notes || ""} onChange={(e) => patch({ footprint_notes: e.target.value })} />
                      </label>
                      {saveError && <p className="form-error">{saveError}</p>}
                      <div className="form-actions">
                        <button type="button" className="btn" onClick={cancelEditFootprint}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving || !isDirty}>{saving ? "Saving…" : "Save changes"}</button>
                      </div>
                    </form>
                  ) : (
                    <div className="expansion-footprint-view">
                      <div>
                        <div className="expansion-summary-label">Expansion Outlook</div>
                        <div><StatusPill variant={outlookMeta(account.expansion_outlook).pillVariant}>{outlookMeta(account.expansion_outlook).label}</StatusPill></div>
                      </div>
                      <div>
                        <div className="expansion-summary-label">Use case / workflow</div>
                        <div className="expansion-summary-value">{account.footprint_use_case || "—"}</div>
                      </div>
                      <div>
                        <div className="expansion-summary-label">Function</div>
                        <div className="expansion-summary-value">{account.footprint_function || "—"}</div>
                      </div>
                      <div>
                        <div className="expansion-summary-label">Business unit / geography</div>
                        <div className="expansion-summary-value">{account.footprint_geography || "—"}</div>
                      </div>
                      <div>
                        <div className="expansion-summary-label">Current commercial value</div>
                        <div className="expansion-summary-value">{account.footprint_value != null ? `$${Number(account.footprint_value).toLocaleString()}` : "—"}</div>
                      </div>
                      <div>
                        <div className="expansion-summary-label">Start date</div>
                        <div className="expansion-summary-value">{formatShortDate(account.footprint_start_date) || "—"}</div>
                      </div>
                      <div>
                        <div className="expansion-summary-label">Key stakeholder</div>
                        <div className="expansion-summary-value">{account.footprint_stakeholder || "—"}</div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <div className="expansion-summary-label">Notes</div>
                        <div className="expansion-summary-value">{account.footprint_notes || "—"}</div>
                      </div>
                    </div>
                  )}
                </div>
                <WhitespaceSection accountId={accountId} whitespace={data.whitespace} onChanged={refresh} />
              </div>
            )}

            {tab === "growth" && (
              <div className="expansion-tab-panel">
                <ExpansionAreasSection accountId={accountId} areas={data.areas} onChanged={refresh} />
                <StakeholdersSection accountId={accountId} stakeholders={data.stakeholders} areas={data.areas} onChanged={refresh} />
              </div>
            )}

            {tab === "research" && (
              <div className="expansion-tab-panel">
                <SignalsSection accountId={accountId} signals={data.signals} areas={data.areas} onChanged={refresh} />
                <QuestionsSection accountId={accountId} questions={data.questions} areas={data.areas} onChanged={refresh} />
              </div>
            )}

            <div className="lead-detail-danger-zone">
              <button type="button" className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
                Delete this account
              </button>
            </div>
          </>
        )}
      </AsyncState>
      {showDeleteModal && account && (
        <DeleteAccountModal
          account={account}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => navigate("/expansion")}
        />
      )}
    </div>
  );
}
