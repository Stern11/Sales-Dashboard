import { COMPANY_SCALE_OPTIONS, SOURCE_CATEGORIES, SOURCE_OTHER, PRIORITY_OPTIONS } from "./constants.js";

/**
 * Shared field set used by both AddLeadModal (create) and LeadDetailDrawer
 * (edit) — a controlled form over a `values` object, changes reported via
 * `onChange(patch)` so the caller owns the actual state.
 */
export function LeadFieldsForm({ values, onChange, sourceLocked, disabled }) {
  function set(key) {
    return (e) => onChange({ [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  }

  // The dropdown shows one of the fixed categories, or "Other" whenever the
  // current value isn't one of them (covers both "user picked Other and is
  // typing" and a blank/never-chosen value).
  const sourceCategory = SOURCE_CATEGORIES.includes(values.source) ? values.source : SOURCE_OTHER;

  return (
    <>
      <div className="form-row">
        <label>
          Company name
          <input type="text" value={values.company_name} onChange={set("company_name")} disabled={disabled} required />
        </label>
        <label>
          Lead contact name
          <input type="text" value={values.contact_name} onChange={set("contact_name")} disabled={disabled} required />
        </label>
      </div>
      <div className="form-row">
        <label>
          Email
          <input type="email" value={values.email || ""} onChange={set("email")} disabled={disabled} />
        </label>
        <label>
          Phone
          <input type="tel" value={values.phone || ""} onChange={set("phone")} disabled={disabled} />
        </label>
      </div>
      <div className="form-row">
        <label>
          Source
          {sourceLocked ? (
            <input type="text" value={values.source} disabled />
          ) : (
            <select
              value={sourceCategory}
              onChange={(e) => onChange({ source: e.target.value === SOURCE_OTHER ? "" : e.target.value })}
              disabled={disabled}
              required
            >
              <option value="" disabled hidden>— Select —</option>
              {SOURCE_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value={SOURCE_OTHER}>{SOURCE_OTHER}</option>
            </select>
          )}
        </label>
        <label>
          Scale of company
          <select value={values.company_scale || ""} onChange={set("company_scale")} disabled={disabled}>
            <option value="">—</option>
            {COMPANY_SCALE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      {!sourceLocked && sourceCategory === SOURCE_OTHER && (
        <label>
          Where did this lead come from?
          <input
            type="text"
            value={values.source}
            onChange={set("source")}
            disabled={disabled}
            placeholder="e.g. Cold outbound, website form…"
            required
          />
        </label>
      )}
      <div className="form-row">
        <label>
          Deal size ($)
          <input type="number" min="0" step="1" value={values.deal_size ?? ""} onChange={set("deal_size")} disabled={disabled} />
        </label>
        <label>
          Priority
          <select value={values.priority || "medium"} onChange={set("priority")} disabled={disabled}>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.formLabel}</option>)}
          </select>
        </label>
      </div>
      <label className="checkbox-row">
        <input type="checkbox" checked={!!values.is_supply_chain} onChange={set("is_supply_chain")} disabled={disabled} />
        Supply chain company
      </label>
      <label>
        Project description
        <textarea value={values.project_description || ""} onChange={set("project_description")} disabled={disabled} />
      </label>
    </>
  );
}
