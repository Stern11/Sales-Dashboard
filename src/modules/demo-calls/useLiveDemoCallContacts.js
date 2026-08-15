import { useMemo } from "react";
import { useSegments, useAllAbmData } from "../abm/useAbmData.js";
import { useAdLeadsData } from "../marketing/useMarketingData.js";
import { guessCompanyFromEmail } from "../../lib/pipelineIntegration.js";
import { MIN_LIVE_CONTACT_DATE } from "./constants.js";

/**
 * Live, read-only detection of "who's reached the Demo Call stage" — reused
 * straight from ABM/Marketing's own data rather than a new server-side
 * HubSpot fetch (see docs/ARCHITECTURE.md's "no scheduled sync" philosophy;
 * this module stays DB-only on the backend, same boundary as Sales
 * Pipeline). Nothing here is persisted — it's merged against the tracked
 * demo_call_leads rows client-side (DemoCallsPage.jsx) to render "Log first
 * call" placeholders for contacts not yet tracked.
 */
export function useLiveDemoCallContacts() {
  const { data: segmentsData, loading: segmentsLoading } = useSegments();
  const segmentIds = useMemo(() => (segmentsData?.segments || []).map((s) => s.id), [segmentsData]);
  const { dataById: abmDataById, loading: abmLoading } = useAllAbmData(segmentIds);
  const { data: sourcesData, loading: sourcesLoading } = useAdLeadsData("lifetime");

  const liveContacts = useMemo(() => {
    const byContactId = new Map();

    for (const payload of Object.values(abmDataById)) {
      for (const l of payload.leads || []) {
        if (!l.meeting_done) continue;
        byContactId.set(String(l.contact_id), {
          contact_id: String(l.contact_id),
          hubspot_origin_module: "abm",
          company_name: l.company || "",
          contact_name: `${l.first || ""} ${l.last || ""}`.trim() || l.email || "(no name)",
          email: l.email || "",
          created_at: l.created_at || null,
        });
      }
    }

    if (sourcesData) {
      const stageIndex = (value) => sourcesData.stages.findIndex((s) => s.value === value);
      const demoCallIdx = stageIndex("opportunity");
      if (demoCallIdx >= 0) {
        for (const l of sourcesData.leads || []) {
          if (stageIndex(l.lifecycle_stage) < demoCallIdx) continue;
          const contactId = String(l.contact_id);
          if (byContactId.has(contactId)) continue; // ABM entry already has a real company name — prefer it
          byContactId.set(contactId, {
            contact_id: contactId,
            hubspot_origin_module: "marketing",
            company_name: guessCompanyFromEmail(l.email),
            contact_name: l.name || "",
            email: l.email || "",
            created_at: l.created_at || null,
          });
        }
      }
    }

    // One-time backlog cleanup (see MIN_LIVE_CONTACT_DATE) — a contact with
    // no known created_at is kept rather than hidden, since there's no way
    // to tell how old it actually is.
    const cutoff = new Date(`${MIN_LIVE_CONTACT_DATE}T00:00:00Z`).getTime();
    return [...byContactId.values()].filter(
      (c) => !c.created_at || new Date(c.created_at).getTime() >= cutoff
    );
  }, [abmDataById, sourcesData]);

  return { liveContacts, loading: segmentsLoading || abmLoading || sourcesLoading };
}
