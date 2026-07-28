import { useApiData } from "../../hooks/useApiData.js";

export function usePipelineData(period) {
  return useApiData(`/api/pipeline?period=${period}`);
}
