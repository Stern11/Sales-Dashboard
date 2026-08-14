import { useApiData } from "../../hooks/useApiData.js";

/** Portfolio list — every account with an expansion planning shell so far, powers the Accounts table + dashboard KPIs. */
export function useAccountExpansionList() {
  return useApiData("/api/account-expansion");
}

/** One account's full Expansion detail (footprint + areas + whitespace + signals + stakeholders + questions). */
export function useAccountExpansionDetail(id) {
  return useApiData(id ? `/api/account-expansion?id=${id}` : null);
}
