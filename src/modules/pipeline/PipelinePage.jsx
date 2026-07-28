import { useState } from "react";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { FunnelChart } from "../../components/FunnelChart.jsx";
import { TrendChart } from "../../components/TrendChart.jsx";
import { PeriodToggle } from "../../components/PeriodToggle.jsx";
import { PageMeta } from "../../components/TopNav.jsx";
import { DealsTable } from "./DealsTable.jsx";
import { usePipelineData } from "./usePipelineData.js";

const PERIOD_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function PipelinePage() {
  const [period, setPeriod] = useState("weekly");
  const { data, loading, error, refresh } = usePipelineData(period);

  return (
    <div>
      <PeriodToggle options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      <AsyncState loading={loading} error={error}>
        {data && (
          <>
            <PageMeta lastUpdated={data.generated_at} onRefresh={refresh} />
            <KpiRow
              items={[
                { label: "Open Deals", value: data.summary.total_open_deals },
                { label: "Open Pipeline Value", value: data.summary.total_open_value },
                { label: "Closed Won", value: data.summary.total_closed_won },
                { label: "Closed Lost", value: data.summary.total_closed_lost },
              ]}
            />
            <section>
              <h2>Open Pipeline by Stage</h2>
              <FunnelChart stages={data.summary.stage_funnel} />
            </section>
            <section>
              <h2>New Deals Created ({period === "monthly" ? "by month" : "by week"})</h2>
              <TrendChart points={data.new_deals_trend} />
            </section>
            <section>
              <h2>Closed-Won Value ({period === "monthly" ? "by month" : "by week"})</h2>
              <TrendChart points={data.closed_won_trend} />
            </section>
            <section>
              <h2>All Deals ({data.deals.length})</h2>
              <DealsTable deals={data.deals} />
            </section>
          </>
        )}
      </AsyncState>
    </div>
  );
}
