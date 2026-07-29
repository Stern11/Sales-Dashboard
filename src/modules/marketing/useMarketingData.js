import { useApiData } from "../../hooks/useApiData.js";

// Reuses /api/sources (channel-attribution data across every lead) — this
// page just scopes the view to LinkedIn. See MarketingPage.jsx.
export function useAdLeadsData(period) {
  return useApiData(`/api/sources?period=${period}`);
}

export function useAdSpendData() {
  return useApiData("/api/marketing/spend");
}
