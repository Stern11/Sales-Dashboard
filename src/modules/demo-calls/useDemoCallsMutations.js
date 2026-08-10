import { useApiMutation } from "../../hooks/useApiMutation.js";

/** Create/edit/call-log/status wrappers around useApiMutation for the Demo Calls module. */
export function useDemoCallsMutations() {
  const { mutate, loading, error } = useApiMutation();

  return {
    loading,
    error,
    createLead: (fields, actor) => mutate("/api/demo-calls", { method: "POST", body: { ...fields, actor } }),
    updateLead: (id, fields, actor) => mutate(`/api/demo-calls/${id}`, { method: "PATCH", body: { ...fields, actor } }),
    addCall: (id, fields, actor) => mutate(`/api/demo-calls/${id}/calls`, { method: "POST", body: { ...fields, actor } }),
    updateCall: (id, callId, fields, actor) =>
      mutate(`/api/demo-calls/${id}/calls/${callId}`, { method: "PATCH", body: { ...fields, actor } }),
    setStatus: (id, { status, reason, actor }) =>
      mutate(`/api/demo-calls/${id}/status`, { method: "POST", body: { status, reason, actor } }),
    linkPipeline: (id, pipelineLeadId, actor) =>
      mutate(`/api/demo-calls/${id}/link-pipeline`, { method: "POST", body: { pipeline_lead_id: pipelineLeadId, actor } }),
    deleteLead: (id, { confirm_company_name, actor }) =>
      mutate(`/api/demo-calls/${id}`, { method: "DELETE", body: { confirm_company_name, actor } }),
  };
}
