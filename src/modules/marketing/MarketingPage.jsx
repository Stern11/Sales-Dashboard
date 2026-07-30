import { useMemo, useState } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { PageMeta } from "../../components/TopNav.jsx";
import { AdLeadsTable } from "./AdLeadsTable.jsx";
import { useAdLeadsData, useAdSpendData } from "./useMarketingData.js";

const PERIOD_OPTIONS = [
  { value: "lifetime", label: "Lifetime" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
];

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// LinkedIn Ads is the only paid channel scoped in today — see docs/ARCHITECTURE.md
// for how to add another (Google/Meta ads) alongside it.
const AD_CHANNEL = "linkedin";

export function MarketingPage() {
  const [period, setPeriod] = useState("lifetime");
  const { data, loading, error, refresh } = useAdLeadsData(period);
  const spend = useAdSpendData();

  const stageLabel = (value) => data?.stages.find((s) => s.value === value)?.label || value;

  const adLeads = useMemo(() => {
    if (!data) return [];
    return data.leads.filter((l) => l.channel.toLowerCase() === AD_CHANNEL);
  }, [data]);

  const funnel = useMemo(() => {
    if (!data) return [];
    const stageIndex = (value) => data.stages.findIndex((s) => s.value === value);
    return data.stages.map((s, i) => ({
      stage: s.label,
      count: adLeads.filter((l) => stageIndex(l.lifecycle_stage) >= i).length,
    }));
  }, [data, adLeads]);

  // Cumulative — reached this stage or any stage beyond it — not just
  // currently sitting there. A lead that did a demo call and has since moved
  // on to SQL still counts toward "Demo Calls"; lifecyclestage only holds
  // the *current* stage, so counting exact matches undercounts total
  // activity by however many leads have since progressed further.
  const stageIdx = (value) => data?.stages.findIndex((s) => s.value === value) ?? -1;
  const demoCallIdx = stageIdx("opportunity");
  const sqlIdx = stageIdx("salesqualifiedlead");
  const demoCallCount = demoCallIdx >= 0 ? adLeads.filter((l) => stageIdx(l.lifecycle_stage) >= demoCallIdx).length : 0;
  const sqlCount = sqlIdx >= 0 ? adLeads.filter((l) => stageIdx(l.lifecycle_stage) >= sqlIdx).length : 0;

  return (
    <div>
      <PeriodToggle options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} />
            <KpiRow
              items={[
                {
                  label: "Ad Spend",
                  value: spend.data ? currency.format(spend.data.total_spend) : "—",
                  sub: spend.error ? "Not available yet" : undefined,
                },
                {
                  label: "Live Campaigns",
                  value: spend.data ? spend.data.live_campaigns : "—",
                  sub: spend.error ? "Not available yet" : undefined,
                },
                { label: "LinkedIn Ad Leads", value: adLeads.length },
                { label: "Demo Calls", value: demoCallCount, sub: "reached this stage or beyond" },
                { label: "SQL", value: sqlCount, sub: "reached this stage or beyond" },
              ]}
            />
            {spend.error && (
              <p className="subtitle" style={{ marginBottom: 16 }}>
                Ad Spend / Live Campaigns: {spend.error} — LinkedIn Ad Leads, Demo Calls, SQL, and the funnel below
                don't depend on this and are live.
              </p>
            )}
            <section>
              <h2>LinkedIn Ads — Lifecycle Funnel</h2>
              <FunnelChart stages={funnel} />
            </section>
            <section>
              <h2>LinkedIn Ad Leads ({adLeads.length})</h2>
              <AdLeadsTable leads={adLeads} stageLabel={stageLabel} />
            </section>
          </>
        )}
      </AsyncState>
    </div>
  );
}
