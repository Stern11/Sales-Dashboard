import { useApiData } from "../../hooks/useApiData.js";

/** Full tracked-lead list + funnel/KPI summary — powers the Demo Calls table. */
export function useDemoCallsList() {
  return useApiData("/api/demo-calls");
}

/** One lead's full detail (fields + call log) for the drawer. */
export function useDemoCallLead(id) {
  return useApiData(id ? `/api/demo-calls/${id}` : null);
}

/**
 * Meetings + Notes HubSpot has on file for a contact — powers the "Import
 * from HubSpot" review panel (ImportFromHubspotPanel.jsx). Skips the fetch
 * until a contactId is known (e.g. drawer not yet loaded).
 */
export function useHubspotEngagements(contactId) {
  return useApiData(contactId ? `/api/demo-calls?action=hubspot-engagements&contact_id=${encodeURIComponent(contactId)}` : null);
}
