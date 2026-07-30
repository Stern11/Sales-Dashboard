import { useApiData } from "../../hooks/useApiData.js";

/** Full lead list + stage-count summary — powers the board and list views. */
export function usePipelineList() {
  return useApiData("/api/pipeline");
}

/** One lead's full detail (fields + notes + stage history) for the drawer. */
export function usePipelineLead(id) {
  return useApiData(id ? `/api/pipeline/${id}` : null);
}
