import { DataTable } from "../../components/DataTable.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { STAGES, currency, stageMeta, priorityMeta } from "./constants.js";

const UNSPECIFIED_REGION = "Unspecified";

export function PipelineTable({ leads, onSelect }) {
  const sourceOptions = [...new Set(leads.map((l) => l.source))].sort();
  const regionOptions = [...new Set(leads.map((l) => l.region || UNSPECIFIED_REGION))].sort();

  return (
    <DataTable
      rows={leads}
      rowKey={(l) => l.id}
      searchPlaceholder="Search company, contact, email…"
      searchKeys={["company_name", "contact_name", "email"]}
      defaultSort={{ key: "updated_at", dir: -1 }}
      onRowClick={(l) => onSelect(l.id)}
      filters={[
        { key: "stage", label: "All stages", options: STAGES.map((s) => ({ value: s.value, label: s.label })), getValue: (l) => l.stage },
        { key: "region", label: "All regions", options: regionOptions, getValue: (l) => l.region || UNSPECIFIED_REGION },
        { key: "source", label: "All sources", options: sourceOptions, getValue: (l) => l.source },
      ]}
      columns={[
        { key: "company_name", label: "Company", nameCell: true },
        { key: "contact_name", label: "Contact" },
        {
          key: "stage", label: "Stage",
          render: (l) => <StatusPill variant={stageMeta(l.stage).pillVariant}>{stageMeta(l.stage).label}</StatusPill>,
        },
        {
          key: "priority", label: "Priority",
          render: (l) => <StatusPill variant={priorityMeta(l.priority).pillVariant}>{priorityMeta(l.priority).label}</StatusPill>,
        },
        { key: "region", label: "Region", render: (l) => l.region || "—" },
        { key: "source", label: "Source" },
        { key: "deal_size", label: "Deal Size", render: (l) => (l.deal_size != null ? currency.format(l.deal_size) : "—") },
        { key: "updated_at", label: "Updated", render: (l) => (l.updated_at ? new Date(l.updated_at).toLocaleDateString() : "—") },
      ]}
    />
  );
}
