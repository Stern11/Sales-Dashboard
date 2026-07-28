import { useApiData } from "../../hooks/useApiData.js";

export function useSourcesData(period) {
  return useApiData(`/api/sources?period=${period}`);
}
