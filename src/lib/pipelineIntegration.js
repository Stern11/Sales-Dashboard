// The one deliberate seam between the previously-fully-siloed ABM/Marketing
// modules and the Pipeline module — everything the "Add to pipeline" retrofit
// needs lives here so AbmPage/MarketingPage don't reach into
// src/modules/pipeline/ internals directly.

import { useApiData } from "../hooks/useApiData.js";

/**
 * Bulk "already in pipeline" lookup for a list of HubSpot contact ids —
 * powers the Pipeline column/badge in the ABM and Marketing lead tables so
 * a lead already copied into the pipeline doesn't get silently duplicated.
 */
export function usePipelineCheck(contactIds) {
  const ids = (contactIds || []).filter(Boolean).map(String);
  const url = ids.length ? `/api/pipeline/check?contact_ids=${ids.join(",")}` : null;
  const { data, refresh } = useApiData(url);
  return { inPipeline: data?.in_pipeline || {}, refresh };
}

/**
 * Marketing's channel-attribution lead data (api/sources/index.js) has no
 * company field at all — only a contact. For bulk "Add to pipeline" (which
 * skips the review modal, see MarketingPage.jsx), the best guess available
 * is the email domain; the user can correct it afterward in the pipeline
 * drawer, same as any other field.
 */
export function guessCompanyFromEmail(email) {
  const domain = (email || "").split("@")[1]?.split(".")[0];
  if (!domain) return "Unknown Company";
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

// Leads sourced from ABM/Performance Marketing are pre-qualified target
// accounts in supply-chain-adjacent segments — default is_supply_chain to
// true for both retrofit paths; editable afterward like any other field.
export function abmLeadToPipelinePrefill(lead) {
  return {
    company_name: lead.company || "",
    contact_name: `${lead.first || ""} ${lead.last || ""}`.trim(),
    email: lead.email || "",
    phone: "",
    source: "ABM",
    source_locked: true,
    is_supply_chain: true,
    hubspot_contact_id: String(lead.contact_id),
    hubspot_origin_module: "abm",
  };
}

export function marketingLeadToPipelinePrefill(lead) {
  return {
    company_name: guessCompanyFromEmail(lead.email),
    contact_name: lead.name || "",
    email: lead.email || "",
    phone: "",
    source: "Ads",
    source_locked: true,
    is_supply_chain: true,
    hubspot_contact_id: String(lead.contact_id),
    hubspot_origin_module: "marketing",
  };
}
