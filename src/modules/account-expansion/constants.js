// Frontend-facing mirror of lib/account-expansion/constants.js — labels and
// pill colors for the UI. See src/modules/demo-calls/constants.js for the
// pattern this follows. Colors reuse this app's existing pill variants
// (StatusPill.jsx) rather than a new palette.

export const EXPANSION_OUTLOOK_OPTIONS = [
  { value: "high", label: "High", pillVariant: "ready" },
  { value: "medium", label: "Medium", pillVariant: "stage" },
  { value: "early", label: "Early", pillVariant: "notstarted" },
];
export function outlookMeta(value) {
  return EXPANSION_OUTLOOK_OPTIONS.find((o) => o.value === value) || { value, label: "Not set", pillVariant: "notstarted" };
}

export const AREA_STATUS_OPTIONS = [
  { value: "idea", label: "Idea", pillVariant: "notstarted" },
  { value: "researching", label: "Researching", pillVariant: "stage" },
  { value: "validated", label: "Validated", pillVariant: "ready" },
];
export function areaStatusMeta(value) {
  return AREA_STATUS_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "stage" };
}

export const RELEVANCE_OPTIONS = [
  { value: "high", label: "High", pillVariant: "ready" },
  { value: "medium", label: "Medium", pillVariant: "stage" },
  { value: "low", label: "Low", pillVariant: "cold" },
];
export function relevanceMeta(value) {
  return RELEVANCE_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "stage" };
}

export const WHITESPACE_STATUS_OPTIONS = [
  { value: "current", label: "Current", pillVariant: "ready" },
  { value: "potential", label: "Potential", pillVariant: "stage" },
  { value: "unknown", label: "Unknown", pillVariant: "notstarted" },
];
export function whitespaceStatusMeta(value) {
  return WHITESPACE_STATUS_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "notstarted" };
}

export const SIGNAL_TYPE_OPTIONS = [
  { value: "company_strategy", label: "Company Strategy" },
  { value: "leadership", label: "Leadership" },
  { value: "transformation", label: "Transformation" },
  { value: "hiring", label: "Hiring" },
  { value: "technology", label: "Technology" },
  { value: "operations", label: "Operations" },
  { value: "internal_learning", label: "Internal Learning" },
  { value: "other", label: "Other" },
];
export function signalTypeLabel(value) {
  return SIGNAL_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
}

export const RELATIONSHIP_OPTIONS = [
  { value: "known", label: "Known", pillVariant: "ready" },
  { value: "need_intro", label: "Need Intro", pillVariant: "stage" },
  { value: "research", label: "Research", pillVariant: "cold" },
  { value: "unknown", label: "Unknown", pillVariant: "notstarted" },
];
export function relationshipMeta(value) {
  return RELATIONSHIP_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "notstarted" };
}

export const QUESTION_PRIORITY_OPTIONS = [
  { value: "high", label: "High", pillVariant: "supplychain" },
  { value: "medium", label: "Medium", pillVariant: "stage" },
  { value: "low", label: "Low", pillVariant: "notstarted" },
];
export function questionPriorityMeta(value) {
  return QUESTION_PRIORITY_OPTIONS.find((o) => o.value === value) || { value, label: value, pillVariant: "stage" };
}

/** dateStr is a plain "YYYY-MM-DD" string — same local-midnight parsing as src/modules/demo-calls/constants.js's formatCallDate, for the same reason (avoids the UTC-string-parsing day-early bug). */
export function formatShortDate(dateStr) {
  if (!dateStr) return null;
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
