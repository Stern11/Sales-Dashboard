import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { PageMeta } from "../../components/TopNav.jsx";
import { KanbanBoard } from "./KanbanBoard.jsx";
import { PipelineTable } from "./PipelineTable.jsx";
import { LeadDetailDrawer } from "./LeadDetailDrawer.jsx";
import { AddLeadModal } from "./AddLeadModal.jsx";
import { usePipelineList } from "./usePipelineData.js";
import { ACTIVE_STAGES, currency, regionBucket, summarizeLeads, REGION_CATEGORIES, REGION_OTHER, REGION_UNSPECIFIED } from "./constants.js";

const VIEW_OPTIONS = [
  { value: "board", label: "Board" },
  { value: "list", label: "List" },
];

// Fixed display order for region buckets; only ones actually present in the
// data are rendered as an option, so custom free-text "Other" values never
// blow up the list.
const REGION_BUCKET_ORDER = [...REGION_CATEGORIES, REGION_OTHER, REGION_UNSPECIFIED];

export function PipelinePage() {
  const [view, setView] = useState("board");
  const [regionFilter, setRegionFilter] = useState(""); // "" = all regions, matches the native <select> convention used by DataTable's own filters
  const [showSideStates, setShowSideStates] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedLeadId, setSelectedLeadId] = useState(() => searchParams.get("lead"));
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { data, loading, error, refresh } = usePipelineList();

  // Lets a "you were tagged" email link straight to a lead (?lead=<id>) open
  // its detail drawer on load, same as clicking it in the board/list would.
  function selectLead(id) {
    setSelectedLeadId(id);
    setSearchParams(id ? { lead: id } : {}, { replace: true });
  }

  // Neon's round-trip is ~1-2s (see docs/ARCHITECTURE.md) — waiting for a
  // full refetch before a dragged card visually moves feels laggy. This
  // holds a locally-patched copy of the leads list applied the instant a
  // drop happens; it's cleared (and server truth takes back over) every
  // time `data` changes, which happens naturally once the background
  // refresh() triggered after the real mutation resolves.
  const [overrideLeads, setOverrideLeads] = useState(null);
  useEffect(() => { setOverrideLeads(null); }, [data]);
  const leads = overrideLeads || data?.leads || [];

  const regionOptions = useMemo(() => {
    const counts = new Map();
    for (const l of leads) {
      const bucket = regionBucket(l.region);
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }
    return REGION_BUCKET_ORDER.filter((bucket) => counts.has(bucket))
      .map((bucket) => ({ value: bucket, label: `${bucket} (${counts.get(bucket)})` }));
  }, [leads]);

  // If the active region filter no longer matches any lead (e.g. the last
  // lead in that bucket was deleted or moved), fall back to "All" instead of
  // silently showing an empty board/list with no visible way out.
  useEffect(() => {
    if (regionFilter && !regionOptions.some((o) => o.value === regionFilter)) {
      setRegionFilter("");
    }
  }, [regionOptions, regionFilter]);

  const filteredLeads = regionFilter ? leads.filter((l) => regionBucket(l.region) === regionFilter) : leads;
  const summary = useMemo(() => summarizeLeads(filteredLeads), [filteredLeads]);
  const filtersActive = regionFilter !== "";
  const sideStateCount = filteredLeads.filter((l) => !ACTIVE_STAGES.some((s) => s.value === l.stage)).length;

  function resetFilters() {
    setRegionFilter("");
    setShowSideStates(false);
    setResetKey((k) => k + 1); // remounts board/list, clearing their own internal search/dropdown state
  }

  function applyOptimisticStage(leadId, toStage) {
    setOverrideLeads((prev) => (prev || data.leads).map((l) => (l.id === leadId ? { ...l, stage: toStage } : l)));
  }

  return (
    <div>
      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <PageMeta lastUpdated={data.generated_at || undefined} onRefresh={refresh} />
            <KpiRow
              items={[
                { label: "Total Leads", value: summary.total },
                { label: "Open Pipeline Value", value: currency.format(summary.open_pipeline_value) },
                { label: "Won", value: summary.by_stage.won || 0 },
                { label: "Cold", value: summary.by_stage.cold || 0 },
                { label: "Lost", value: summary.by_stage.lost || 0 },
              ]}
            />
            <section>
              <h2>Open Pipeline by Stage</h2>
              <FunnelChart
                stages={ACTIVE_STAGES.map((s) => ({ stage: s.label, count: summary.by_stage[s.value] || 0 }))}
              />
            </section>
            <div className="pipeline-toolbar">
              <div className="pipeline-toolbar-group">
                <PeriodToggle options={VIEW_OPTIONS} value={view} onChange={setView} />
              </div>
              <div className="pipeline-toolbar-group">
                {view === "board" && (
                  <button type="button" className="btn" onClick={() => setShowSideStates((v) => !v)}>
                    {showSideStates ? "Hide" : "Show"} Cold & Lost ({sideStateCount})
                  </button>
                )}
                <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                  <option value="">All regions</option>
                  {regionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {filtersActive && (
                  <button type="button" className="btn btn-reset-filters" onClick={resetFilters}>
                    ✕ Reset filters
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => setAddModalOpen(true)}>+ Add Lead</button>
              </div>
            </div>
            <section>
              {view === "board" ? (
                <KanbanBoard
                  key={resetKey}
                  leads={filteredLeads}
                  showSideStates={showSideStates}
                  onSelect={selectLead}
                  onChanged={refresh}
                  onOptimisticMove={applyOptimisticStage}
                />
              ) : (
                <PipelineTable key={resetKey} leads={filteredLeads} onSelect={selectLead} />
              )}
            </section>
          </>
        )}
      </AsyncState>

      {selectedLeadId && (
        <LeadDetailDrawer leadId={selectedLeadId} onClose={() => selectLead(null)} onChanged={refresh} />
      )}
      {addModalOpen && (
        <AddLeadModal onClose={() => setAddModalOpen(false)} onCreated={refresh} />
      )}
    </div>
  );
}
