import { useApiData } from "../../hooks/useApiData.js";

export function useSegments() {
  return useApiData("/api/segments");
}

export function useAbmData(segmentId) {
  return useApiData(segmentId ? `/api/abm?segment=${encodeURIComponent(segmentId)}` : null);
}

export function useAbmOverview() {
  return useApiData("/api/abm/overview");
}
