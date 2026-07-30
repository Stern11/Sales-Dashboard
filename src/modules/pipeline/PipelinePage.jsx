import { useEffect, useState } from "react";
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
import { ACTIVE_STAGES, currency } from "./constants.js";

const VIEW_OPTIONS = [
  { value: "board", label: "Board" },
  { value: "list", label: "List" },
];

export function PipelinePage() {
  const [view, setView] = useState("board");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const { data, loading, error, refresh } = usePipelineList();

  // Neon's round-trip is ~1-2s (see docs/ARCHITECTURE.md) — waiting for a
  // full refetch before a dragged card visually moves feels laggy. This
  // holds a locally-patched copy of the leads list applied the instant a
  // drop happens; it's cleared (and server truth takes back over) every
  // time `data` changes, which happens naturally once the background
  // refresh() triggered after the real mutation resolves.
  const [overrideLeads, setOverrideLeads] = useState(null);
  useEffect(() => { setOverrideLeads(null); }, [data]);
  const leads = overrideLeads || data?.leads || [];

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
                { label: "Total Leads", value: data.summary.total },
                { label: "Open Pipeline Value", value: currency.format(data.summary.open_pipeline_value) },
                { label: "Won", value: data.summary.by_stage.won || 0 },
                { label: "Cold", value: data.summary.by_stage.cold || 0 },
                { label: "Lost", value: data.summary.by_stage.lost || 0 },
              ]}
            />
            <section>
              <h2>Open Pipeline by Stage</h2>
              <FunnelChart
                stages={ACTIVE_STAGES.map((s) => ({ stage: s.label, count: data.summary.by_stage[s.value] || 0 }))}
              />
            </section>
            <div className="pipeline-toolbar">
              <PeriodToggle options={VIEW_OPTIONS} value={view} onChange={setView} />
              <button type="button" className="btn btn-primary" onClick={() => setAddModalOpen(true)}>+ Add Lead</button>
            </div>
            <section>
              {view === "board" ? (
                <KanbanBoard
                  leads={leads}
                  onSelect={setSelectedLeadId}
                  onChanged={refresh}
                  onOptimisticMove={applyOptimisticStage}
                />
              ) : (
                <PipelineTable leads={leads} onSelect={setSelectedLeadId} />
              )}
            </section>
          </>
        )}
      </AsyncState>

      {selectedLeadId && (
        <LeadDetailDrawer leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} onChanged={refresh} />
      )}
      {addModalOpen && (
        <AddLeadModal onClose={() => setAddModalOpen(false)} onCreated={refresh} />
      )}
    </div>
  );
}
