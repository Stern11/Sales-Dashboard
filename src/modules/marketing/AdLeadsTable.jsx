import { DataTable } from "../../components/DataTable.jsx";

// No channel column/filter — this table is always pre-scoped to one ad
// channel (LinkedIn today) by the page, so every row already shares it. No
// campaign column either — which specific ad/campaign a lead came from is
// operational detail, not something a senior stakeholder needs on this view.
export function AdLeadsTable({ leads, stageLabel }) {
  const stageOptions = [...new Set(leads.map((l) => l.lifecycle_stage).filter(Boolean))].map((value) => ({
    value,
    label: stageLabel(value),
  }));

  return (
    <DataTable
      rows={leads}
      rowKey={(l) => l.contact_id}
      searchPlaceholder="Search name, email…"
      searchKeys={["name", "email"]}
      defaultSort={{ key: "created_at", dir: -1 }}
      filters={[{ key: "stage", label: "All stages", options: stageOptions, getValue: (l) => l.lifecycle_stage }]}
      columns={[
        { key: "name", label: "Name", nameCell: true },
        { key: "email", label: "Email" },
        { key: "lifecycle_stage", label: "Stage", render: (l) => (l.lifecycle_stage ? stageLabel(l.lifecycle_stage) : "—") },
        { key: "num_meetings", label: "Meetings" },
        { key: "created_at", label: "Created", render: (l) => (l.created_at ? new Date(l.created_at).toLocaleDateString() : "—") },
      ]}
    />
  );
}
