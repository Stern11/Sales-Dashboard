import { DataTable } from "../../components/DataTable.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function StageCell({ deal }) {
  if (deal.is_closed_won) return <StatusPill variant="ready">Closed Won</StatusPill>;
  if (deal.is_closed_lost) return <StatusPill variant="missing">Closed Lost</StatusPill>;
  return <StatusPill variant="stage">{deal.stage}</StatusPill>;
}

export function DealsTable({ deals }) {
  const stageOptions = [...new Set(deals.map((d) => d.stage))].sort();

  return (
    <DataTable
      rows={deals}
      rowKey={(d) => d.id}
      searchPlaceholder="Search deal name…"
      searchKeys={["name"]}
      defaultSort={{ key: "created_at", dir: -1 }}
      filters={[{ key: "stage", label: "All stages", options: stageOptions, getValue: (d) => d.stage }]}
      columns={[
        { key: "name", label: "Deal", nameCell: true },
        { key: "stage", label: "Stage", sortable: false, render: (d) => <StageCell deal={d} /> },
        { key: "amount", label: "Amount", render: (d) => currency.format(d.amount) },
        { key: "created_at", label: "Created", render: (d) => (d.created_at ? new Date(d.created_at).toLocaleDateString() : "—") },
        { key: "close_date", label: "Close Date", render: (d) => (d.close_date ? new Date(d.close_date).toLocaleDateString() : "—") },
      ]}
    />
  );
}
