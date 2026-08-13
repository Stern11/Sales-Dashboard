import { DataTable } from "../../components/DataTable.jsx";
import { StatusPill } from "../../components/StatusPill.jsx";
import { outcomeMeta, statusMeta, effectiveStatus } from "./constants.js";

const ORIGIN_LABEL = { abm: "ABM", marketing: "Marketing", manual: "Manual" };

function originLabel(value) {
  return ORIGIN_LABEL[value] || "Manual";
}

/**
 * Only a tracked lead that's genuinely active (not irrelevant, and not
 * sitting on an unresolved no-show — see effectiveStatus) and not already
 * in Pipeline is eligible for bulk add, mirrors AdLeadsTable/LeadTable's
 * PipelineCell.
 */
function isSelectable(row) {
  return row._kind === "tracked" && effectiveStatus(row.status, row.last_call_outcome) === "active" && !row.pipeline_lead_id;
}

function SelectCell({ row, selectedIds, onToggleSelect }) {
  if (row._kind === "tracked" && row.pipeline_lead_id) return <StatusPill variant="ready">In Pipeline</StatusPill>;
  if (!isSelectable(row)) return "—";
  return (
    <input
      type="checkbox"
      checked={selectedIds.has(row.id)}
      onClick={(e) => e.stopPropagation()}
      onChange={() => onToggleSelect(row.id)}
      title="Select to add to pipeline"
    />
  );
}

/**
 * Rows are a mix of tracked demo_call_leads rows (`_kind: "tracked"`) and
 * live-but-untracked HubSpot contacts (`_kind: "virtual"` — reached the Demo
 * Call stage but nobody's logged a call yet). Clicking a tracked row opens
 * its detail drawer; clicking a virtual row opens "Log first meeting" prefilled
 * from the live contact. Neither is persisted just by appearing here — see
 * useLiveDemoCallContacts.js.
 */
export function DemoCallsTable({ rows, onOpenLead, onLogFirstCall, selectedIds, onToggleSelect }) {
  const originOptions = [...new Set(rows.map((r) => r.hubspot_origin_module || "manual"))].map((value) => ({
    value,
    label: originLabel(value),
  }));

  return (
    <DataTable
      rows={rows}
      rowKey={(r) => r.id}
      searchPlaceholder="Search company, contact, email…"
      searchKeys={["company_name", "contact_name", "email"]}
      defaultSort={{ key: "created_at", dir: -1 }}
      onRowClick={(r) => (r._kind === "tracked" ? onOpenLead(r.id) : onLogFirstCall(r))}
      filters={[
        {
          key: "status",
          label: "All statuses",
          options: [
            { value: "active", label: "Active" },
            { value: "no_show", label: "No Show" },
            { value: "irrelevant", label: "Irrelevant" },
            { value: "not_logged", label: "Not logged yet" },
          ],
          getValue: (r) => (r._kind === "virtual" ? "not_logged" : effectiveStatus(r.status, r.last_call_outcome)),
        },
        { key: "origin", label: "All sources", options: originOptions, getValue: (r) => r.hubspot_origin_module || "manual" },
      ]}
      columns={[
        {
          key: "select", label: "Pipeline", sortable: false,
          render: (r) => <SelectCell row={r} selectedIds={selectedIds} onToggleSelect={onToggleSelect} />,
        },
        { key: "company_name", label: "Company", nameCell: true },
        { key: "contact_name", label: "Contact" },
        { key: "email", label: "Email" },
        {
          key: "origin",
          label: "Source",
          sortValue: (r) => originLabel(r.hubspot_origin_module || "manual"),
          render: (r) => originLabel(r.hubspot_origin_module || "manual"),
        },
        {
          key: "status",
          label: "Status",
          sortValue: (r) => (r._kind === "virtual" ? "not_logged" : effectiveStatus(r.status, r.last_call_outcome)),
          render: (r) =>
            r._kind === "virtual"
              ? <StatusPill variant="notstarted">Not logged — click to log first meeting</StatusPill>
              : (() => {
                  const eff = effectiveStatus(r.status, r.last_call_outcome);
                  return <StatusPill variant={statusMeta(eff).pillVariant}>{statusMeta(eff).label}</StatusPill>;
                })(),
        },
        {
          key: "call_count",
          label: "Meetings",
          sortValue: (r) => Number(r.call_count) || 0,
          render: (r) => (r._kind === "tracked" ? Number(r.call_count) || 0 : "—"),
        },
        {
          key: "last_call_outcome",
          label: "Last meeting",
          sortable: false,
          render: (r) =>
            r._kind === "tracked" && r.last_call_outcome
              ? <StatusPill variant={outcomeMeta(r.last_call_outcome).pillVariant}>{outcomeMeta(r.last_call_outcome).label}</StatusPill>
              : "—",
        },
      ]}
    />
  );
}
