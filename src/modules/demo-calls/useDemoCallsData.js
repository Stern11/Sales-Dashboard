import { useApiData } from "../../hooks/useApiData.js";

/** Full tracked-lead list + funnel/KPI summary — powers the Demo Calls table. */
export function useDemoCallsList() {
  return useApiData("/api/demo-calls");
}

/** One lead's full detail (fields + call log) for the drawer. */
export function useDemoCallLead(id) {
  return useApiData(id ? `/api/demo-calls/${id}` : null);
}
