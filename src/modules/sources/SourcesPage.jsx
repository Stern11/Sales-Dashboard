import { useMemo, useState } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { PageMeta } from "../../components/TopNav.jsx";
import { SourceLeadsTable } from "./SourceLeadsTable.jsx";
import { useSourcesData } from "./useSourcesData.js";

const PERIOD_OPTIONS = [
  { value: "lifetime", label: "Lifetime" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
];

export function SourcesPage() {
  const [period, setPeriod] = useState("lifetime");
  const [channel, setChannel] = useState("all");
  const { data, loading, error, refresh } = useSourcesData(period);

  const stageLabel = (value) => data?.stages.find((s) => s.value === value)?.label || value;

  const filteredLeads = useMemo(() => {
    if (!data) return [];
    return channel === "all" ? data.leads : data.leads.filter((l) => l.channel === channel);
  }, [data, channel]);

  const funnel = useMemo(() => {
    if (!data) return [];
    const stageIndex = (value) => data.stages.findIndex((s) => s.value === value);
    return data.stages.map((s, i) => ({
      stage: s.label,
      count: filteredLeads.filter((l) => stageIndex(l.lifecycle_stage) >= i).length,
    }));
  }, [data, filteredLeads]);

  const linkedinChannel = data?.summary.channels.find((c) => c.channel.toLowerCase().includes("linkedin"));
  const linkedinDemoIdx = data?.stages.findIndex((s) => s.value === "opportunity");
  const linkedinAdvanced =
    linkedinChannel && linkedinDemoIdx >= 0
      ? data.leads.filter(
          (l) => l.channel === linkedinChannel.channel && data.stages.findIndex((s) => s.value === l.lifecycle_stage) >= linkedinDemoIdx
        ).length
      : null;

  return (
    <div>
      <PeriodToggle options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} />
            <KpiRow
              items={[
                { label: "Total Leads", value: data.summary.total_leads },
                { label: "Meetings Booked", value: data.summary.total_meetings },
                ...(linkedinChannel
                  ? [
                      { label: "LinkedIn Leads", value: linkedinChannel.count },
                      { label: "LinkedIn → Demo Call+", value: linkedinAdvanced ?? "—" },
                    ]
                  : []),
              ]}
            />
            <section>
              <h2>Channel</h2>
              <PeriodToggle
                options={[{ value: "all", label: "All Channels" }, ...data.summary.channels.map((c) => ({ value: c.channel, label: `${c.channel} (${c.count})` }))]}
                value={channel}
                onChange={setChannel}
              />
            </section>
            <section>
              <h2>Lifecycle Funnel{channel !== "all" ? ` — ${channel}` : ""}</h2>
              <FunnelChart stages={funnel} />
            </section>
            <section>
              <h2>Leads ({filteredLeads.length})</h2>
              <SourceLeadsTable leads={filteredLeads} stageLabel={stageLabel} />
            </section>
          </>
        )}
      </AsyncState>
    </div>
  );
}
