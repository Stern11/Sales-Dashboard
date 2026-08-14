// Company-scale options and validation, shared by the Pipeline and Demo
// Calls server modules.
//
// Both defined this list identically, and both exported an
// `isValidCompanyScale` — but with *different contracts*: pipeline's
// rejected the empty string, demo-calls' accepted it. Same name, same
// apparent purpose, different answer for the same input, which is the kind
// of divergence that only surfaces when a form starts posting to the other
// endpoint.
//
// Unified on the permissive behavior. Neither client sends "" today (both
// convert it to null before posting — see AddLeadModal.jsx), so nothing
// changes in practice; accepting it removes the trap rather than tightening
// a rule nobody was relying on.

export const COMPANY_SCALE_OPTIONS = [
  { value: "startup", label: "Startup (<50 employees)" },
  { value: "smb", label: "SMB (50–200)" },
  { value: "mid_market", label: "Mid-Market (200–1000)" },
  { value: "enterprise", label: "Enterprise (1000+)" },
];

export const COMPANY_SCALE_VALUES = COMPANY_SCALE_OPTIONS.map((o) => o.value);

/** True for a known scale, or for "not specified" (null/undefined/""), which is a valid state — the column is nullable. */
export function isValidCompanyScale(value) {
  return value == null || value === "" || COMPANY_SCALE_VALUES.includes(value);
}
