// Frontend-facing mirror of lib/pipeline/constants.js — labels, order, and
// pill colors for the UI. Kept as plain data (not DB enums) so adding a
// stage/scale/source is a one-file-per-side change; see db/schema.sql.

export const STAGES = [
  { value: "sql", label: "SQL", isActive: true, pillVariant: "notstarted", color: "var(--stage-sql)" },
  { value: "discovery", label: "Discovery", isActive: true, pillVariant: "stage", color: "var(--stage-discovery)" },
  { value: "proposal", label: "Proposal", isActive: true, pillVariant: "stage", color: "var(--stage-proposal)" },
  { value: "commercial", label: "Commercial", isActive: true, pillVariant: "stage", color: "var(--stage-commercial)" },
  { value: "won", label: "Won", isActive: true, pillVariant: "ready", color: "var(--stage-won)" },
  { value: "cold", label: "Cold", isActive: false, pillVariant: "cold", color: "var(--stage-cold)" },
  { value: "lost", label: "Lost", isActive: false, pillVariant: "lost", color: "var(--stage-lost)" },
];

// Named separately from STAGES because the board's column set is a display
// decision, not the same thing as the list of stages a lead can be in —
// KanbanBoard splits it into active columns and the collapsed Cold/Lost
// side-states. (The original comment claimed all 7 are shown as columns;
// KanbanBoard has not done that since it gained the collapse behavior.)
export const BOARD_STAGES = STAGES;
export const ACTIVE_STAGES = STAGES.filter((s) => s.isActive);

export function stageMeta(value) {
  return STAGES.find((s) => s.value === value) || { value, label: value, pillVariant: "stage" };
}

// Mirrors summarize() in lib/pipeline/queries.js — recomputed client-side so
// the KPI row and funnel chart can reflect whatever filter is currently
// applied instead of always showing the server's whole-table totals.
export function summarizeLeads(leads) {
  const by_stage = Object.fromEntries(STAGES.map((s) => [s.value, 0]));
  let open_pipeline_value = 0;
  let closed_won_value = 0;
  for (const lead of leads) {
    by_stage[lead.stage] = (by_stage[lead.stage] || 0) + 1;
    if (ACTIVE_STAGES.some((s) => s.value === lead.stage)) open_pipeline_value += Number(lead.deal_size) || 0;
    if (lead.stage === "won") closed_won_value += Number(lead.deal_size) || 0;
  }
  return { total: leads.length, by_stage, open_pipeline_value, closed_won_value };
}

export const COMPANY_SCALE_OPTIONS = [
  { value: "startup", label: "Startup (<50 employees)" },
  { value: "smb", label: "SMB (50–200)" },
  { value: "mid_market", label: "Mid-Market (200–1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

export const PRIORITY_OPTIONS = [
  { value: "high", label: "P0", formLabel: "P0 — High", pillVariant: "lost" },
  { value: "medium", label: "P1", formLabel: "P1 — Medium", pillVariant: "stage" },
  { value: "low", label: "P2", formLabel: "P2 — Low", pillVariant: "cold" },
];

export function priorityMeta(value) {
  return PRIORITY_OPTIONS.find((o) => o.value === value) || PRIORITY_OPTIONS[1];
}

// Fixed source categories — a lead's `source` is one of these, or (when
// SOURCE_OTHER is picked) any free text the user types describing where it
// actually came from. See LeadFieldsForm.jsx for the dropdown + "Other" text
// box this drives.
export const SOURCE_CATEGORIES = ["ABM", "Event", "Ads", "Partner", "Referral", "Demo Call"];
export const SOURCE_OTHER = "Other";

// Same dropdown-plus-Other pattern as source. Optional — a lead can have no
// region set yet.
export const REGION_CATEGORIES = ["US", "UK", "APAC", "India"];
export const REGION_OTHER = "Other";
export const REGION_UNSPECIFIED = "Unspecified";

// Buckets a lead's free-text region into one of the fixed categories, or
// REGION_OTHER for any custom text, or REGION_UNSPECIFIED when unset — keeps
// the region pill filter to a handful of options regardless of how many
// distinct "Other" strings exist across leads.
export function regionBucket(region) {
  if (!region) return REGION_UNSPECIFIED;
  return REGION_CATEGORIES.includes(region) ? region : REGION_OTHER;
}

export const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Shared with the other modules — see src/lib/datetime.js.
export { relativeTime } from "../../lib/datetime.js";
