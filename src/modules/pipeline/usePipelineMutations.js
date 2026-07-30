import { useApiMutation } from "../../hooks/useApiMutation.js";

/** Create/edit/stage-change/note wrappers around useApiMutation for the Sales Pipeline module. */
export function usePipelineMutations() {
  const { mutate, loading, error } = useApiMutation();

  return {
    loading,
    error,
    createLead: (fields, actor) => mutate("/api/pipeline", { method: "POST", body: { ...fields, actor } }),
    updateLead: (id, fields, actor) => mutate(`/api/pipeline/${id}`, { method: "PATCH", body: { ...fields, actor } }),
    changeStage: (id, { to_stage, reason, actor }) =>
      mutate(`/api/pipeline/${id}/stage`, { method: "POST", body: { to_stage, reason, actor } }),
    addNote: (id, { body, author }) => mutate(`/api/pipeline/${id}/notes`, { method: "POST", body: { body, author } }),
    deleteLead: (id, { confirm_company_name, actor }) =>
      mutate(`/api/pipeline/${id}`, { method: "DELETE", body: { confirm_company_name, actor } }),
  };
}
