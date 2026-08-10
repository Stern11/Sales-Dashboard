import { useApiMutation } from "../../hooks/useApiMutation.js";

/**
 * Create/edit/call-log/status wrappers around useApiMutation for the Demo
 * Calls module. Sub-actions on a lead (calls/status/link-pipeline) go
 * through `?action=` on api/demo-calls/[id].js rather than their own path
 * segments/files — that file's header comment explains why (Vercel Hobby's
 * 12-serverless-function-per-deployment cap).
 */
export function useDemoCallsMutations() {
  const { mutate, loading, error } = useApiMutation();

  return {
    loading,
    error,
    createLead: (fields, actor) => mutate("/api/demo-calls", { method: "POST", body: { ...fields, actor } }),
    updateLead: (id, fields, actor) => mutate(`/api/demo-calls/${id}`, { method: "PATCH", body: { ...fields, actor } }),
    addCall: (id, fields, actor) => mutate(`/api/demo-calls/${id}?action=calls`, { method: "POST", body: { ...fields, actor } }),
    updateCall: (id, callId, fields, actor) =>
      mutate(`/api/demo-calls/${id}?action=calls&call_id=${callId}`, { method: "PATCH", body: { ...fields, actor } }),
    setStatus: (id, { status, reason, actor }) =>
      mutate(`/api/demo-calls/${id}?action=status`, { method: "POST", body: { status, reason, actor } }),
    linkPipeline: (id, pipelineLeadId, actor) =>
      mutate(`/api/demo-calls/${id}?action=link-pipeline`, { method: "POST", body: { pipeline_lead_id: pipelineLeadId, actor } }),
    deleteLead: (id, { confirm_company_name, actor }) =>
      mutate(`/api/demo-calls/${id}`, { method: "DELETE", body: { confirm_company_name, actor } }),
  };
}
