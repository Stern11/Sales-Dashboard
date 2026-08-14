// The one deliberate seam between the previously-fully-siloed ABM/Marketing
// modules and the Pipeline module — everything the "Add to pipeline" retrofit
// needs lives here so AbmPage/MarketingPage don't reach into
// src/modules/pipeline/ internals directly.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REFRESH_MS } from "../hooks/useApiData.js";
import { readCache, writeCache } from "./apiCache.js";

/**
 * Bulk "already in pipeline" lookup for a list of HubSpot contact ids —
 * powers the Pipeline column/badge in the ABM and Marketing lead tables so
 * a lead already copied into the pipeline doesn't get silently duplicated.
 *
 * POSTs the id list rather than reusing useApiData's GET-based fetch —
 * Marketing's "Lifetime" view can pass hundreds-to-low-thousands of ids,
 * which as a comma-joined query string risks exceeding typical URL-length
 * limits as the ad-lead dataset grows. Mirrors useApiData's own shape
 * (sessionStorage-cached instant paint + background revalidate + a
 * REFRESH_MS poll) since that behavior is still wanted here, just over POST.
 */
/**
 * A short, stable key for a list of ids.
 *
 * Joining ~2,000 ids produced a multi-kilobyte sessionStorage key. A cheap
 * non-cryptographic digest (FNV-1a) keeps it constant-length; the count is
 * kept alongside it so two different sets can't collide silently on length
 * alone. This key never leaves the browser and guards a best-effort badge
 * cache, so a digest is the right tool rather than something stronger.
 */
function cacheKeyFor(sortedIds) {
  let hash = 0x811c9dc5;
  for (const id of sortedIds) {
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 0x2c; // separator, so ["ab","c"] and ["a","bc"] differ
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${sortedIds.length}-${hash.toString(36)}`;
}

export function usePipelineCheck(contactIds) {
  // Memoized because Marketing's "Lifetime" view passes ~2,000 ids: without
  // this, every render rebuilt a Set, deduped the whole list and allocated a
  // ~20KB joined string — which is also used as a sessionStorage key, so the
  // cost landed on the render path twice over.
  const { ids, key } = useMemo(() => {
    const deduped = [...new Set((contactIds || []).filter(Boolean).map(String))];
    // Sorted so the same set of contacts arriving in a different order
    // (which happens whenever a table re-sorts) is recognized as the same
    // cache entry instead of missing and refetching.
    const sorted = [...deduped].sort();
    return { ids: deduped, key: sorted.length ? `pipeline-check:${cacheKeyFor(sorted)}` : null };
  }, [contactIds]);

  const [inPipeline, setInPipeline] = useState(() => (key && readCache(key)) || {});
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!key) { setInPipeline({}); return; }
    const id = ++requestId.current;
    try {
      const res = await fetch("/api/pipeline/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: ids }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && id === requestId.current) {
        setInPipeline(body.in_pipeline || {});
        writeCache(key, body.in_pipeline || {});
      }
    } catch {
      // Best-effort badge — a failed check just means leads don't show as
      // "already in pipeline" yet, not a broken page. Nothing to surface.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    setInPipeline((key && readCache(key)) || {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [key, load]);

  return { inPipeline, refresh: load };
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

/**
 * "Add to pipeline" from a Demo Calls lead (src/modules/demo-calls/
 * DemoCallLeadDrawer.jsx) — unlike the ABM/Marketing bridges above, this
 * lead already has real company_name/contact_name/email/phone (typed or
 * copied in when it was logged), so nothing needs guessing.
 * hubspot_contact_id/hubspot_origin_module only carry through when the Demo
 * Calls lead came from a live HubSpot detection — a manually-entered one has
 * neither, and that's fine, source_locked still applies.
 */
export function demoCallLeadToPipelinePrefill(lead) {
  return {
    company_name: lead.company_name,
    contact_name: lead.contact_name,
    email: lead.email || "",
    phone: lead.phone || "",
    source: "Demo Call",
    source_locked: true,
    is_supply_chain: true,
    company_scale: lead.company_scale || null,
    hubspot_contact_id: lead.hubspot_contact_id ? String(lead.hubspot_contact_id) : undefined,
    hubspot_origin_module: lead.hubspot_origin_module || "demo-calls",
  };
}
