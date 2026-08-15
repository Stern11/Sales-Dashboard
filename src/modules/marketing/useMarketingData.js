import { useApiData } from "../../hooks/useApiData.js";

// Reuses /api/sources (channel-attribution data across every lead) — this
// page just scopes the view to LinkedIn. See MarketingPage.jsx.
//
// customFrom/customTo only matter (and only reach the URL) when period is
// "custom" — for the three fixed presets they're ignored, so flipping back
// to "Lifetime" after picking a custom range doesn't leave a stale from/to
// on the request.
export function useAdLeadsData(period, customFrom, customTo) {
  const params = new URLSearchParams({ period });
  if (period === "custom") {
    if (customFrom) params.set("from", customFrom);
    if (customTo) params.set("to", customTo);
  }
  return useApiData(`/api/sources?${params.toString()}`);
}

export function useAdSpendData() {
  return useApiData("/api/marketing/spend");
}
