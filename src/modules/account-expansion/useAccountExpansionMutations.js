import { useApiMutation } from "../../hooks/useApiMutation.js";

/**
 * Every write on an account's Expansion planning data, wrapped around
 * useApiMutation — sub-resources (areas/whitespace/signals/stakeholders/
 * questions) go through `?action=`/`?item_id=` on api/account-expansion/index.js
 * rather than their own path segments/files (that file's header comment
 * explains why — Vercel Hobby's 12-serverless-function-per-deployment cap).
 */
export function useAccountExpansionMutations() {
  const { mutate, loading, error } = useApiMutation();

  return {
    loading,
    error,
    createAccount: (fields, actor) => mutate("/api/account-expansion", { method: "POST", body: { ...fields, actor } }),
    deleteAccount: (id, confirmCompanyName) =>
      mutate(`/api/account-expansion?id=${id}`, { method: "DELETE", body: { confirm_company_name: confirmCompanyName } }),
    updateFootprint: (id, fields, actor) => mutate(`/api/account-expansion?id=${id}`, { method: "PATCH", body: { ...fields, actor } }),

    addArea: (id, fields, actor) => mutate(`/api/account-expansion?id=${id}&action=areas`, { method: "POST", body: { ...fields, actor } }),
    updateArea: (id, areaId, fields, actor) =>
      mutate(`/api/account-expansion?id=${id}&action=areas&item_id=${areaId}`, { method: "PATCH", body: { ...fields, actor } }),

    setWhitespace: (id, fields, actor) => mutate(`/api/account-expansion?id=${id}&action=whitespace`, { method: "POST", body: { ...fields, actor } }),
    removeWhitespace: (id, whitespaceId) =>
      mutate(`/api/account-expansion?id=${id}&action=whitespace&item_id=${whitespaceId}`, { method: "DELETE" }),

    addSignal: (id, fields, actor) => mutate(`/api/account-expansion?id=${id}&action=signals`, { method: "POST", body: { ...fields, actor } }),
    updateSignal: (id, signalId, fields, actor) =>
      mutate(`/api/account-expansion?id=${id}&action=signals&item_id=${signalId}`, { method: "PATCH", body: { ...fields, actor } }),
    removeSignal: (id, signalId) => mutate(`/api/account-expansion?id=${id}&action=signals&item_id=${signalId}`, { method: "DELETE" }),

    addStakeholder: (id, fields, actor) => mutate(`/api/account-expansion?id=${id}&action=stakeholders`, { method: "POST", body: { ...fields, actor } }),
    updateStakeholder: (id, stakeholderId, fields, actor) =>
      mutate(`/api/account-expansion?id=${id}&action=stakeholders&item_id=${stakeholderId}`, { method: "PATCH", body: { ...fields, actor } }),
    removeStakeholder: (id, stakeholderId) =>
      mutate(`/api/account-expansion?id=${id}&action=stakeholders&item_id=${stakeholderId}`, { method: "DELETE" }),

    addQuestion: (id, fields, actor) => mutate(`/api/account-expansion?id=${id}&action=questions`, { method: "POST", body: { ...fields, actor } }),
    updateQuestion: (id, questionId, fields, actor) =>
      mutate(`/api/account-expansion?id=${id}&action=questions&item_id=${questionId}`, { method: "PATCH", body: { ...fields, actor } }),
    removeQuestion: (id, questionId) =>
      mutate(`/api/account-expansion?id=${id}&action=questions&item_id=${questionId}`, { method: "DELETE" }),
  };
}
