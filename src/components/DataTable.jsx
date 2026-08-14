import { useDeferredValue, useMemo, useState } from "react";

// One collator, built once. String#localeCompare constructs (or looks up) an
// ICU collator on every call, so using it as a sort comparator meant tens of
// thousands of collator operations per sort — for 2,000 rows that is ~22,000
// comparisons, and the sort below runs on every keystroke.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// How many rows to put in the DOM before asking. Nothing here is
// virtualized, and these tables are fed real HubSpot result sets — the
// Marketing "Lifetime" view passes the LinkedIn subset of ~2,000 contacts
// (api/sources/index.js), and Meetings merges tracked leads with every
// untracked live contact. Every one of those rows was mounted at once, each
// with its own cells and badge components, inside a 560px scroll box that
// showed maybe a dozen. The cap is generous enough that ordinary lists are
// unaffected and never silently hides anything: the count and the control
// below always state the true total.
const DEFAULT_ROW_LIMIT = 200;

/**
 * Generic sortable / searchable / filterable table shared by every module.
 *
 * columns: [{ key, label, sortable=true, render?(row), sortValue?(row) }]
 * rows: array of row objects
 * rowKey(row): string — unique key per row
 * searchPlaceholder, searchKeys: string[] — text search across these row fields (skipped if omitted)
 * filters?: [{ key, label, options: (string | {value, label})[], getValue(row) }] —
 *   each renders a <select>. Plain strings are used as both the filter value
 *   and the displayed label; pass {value, label} when the underlying value
 *   (e.g. a raw HubSpot enum like "opportunity") isn't human-readable on its own.
 * defaultSort?: { key, dir: 1 | -1 }
 * onRowClick?(row): if provided, the whole row becomes clickable (not just
 *   whatever a column's render() makes interactive) — opt-in, so tables that
 *   don't pass it are unaffected.
 */
export function DataTable({ columns, rows, rowKey, searchPlaceholder, searchKeys, filters, defaultSort, onRowClick }) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filterValues, setFilterValues] = useState({});
  const [sort, setSort] = useState(defaultSort || { key: columns[0]?.key, dir: 1 });

  // Typing stays responsive because filtering/sorting reads the *deferred*
  // query: React keeps the input echoing every keystroke immediately and
  // re-runs the expensive pass against the latest settled value instead of
  // once per character.
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    let out = rows;
    if (searchKeys && deferredQuery) {
      const q = deferredQuery.toLowerCase();
      out = out.filter((r) => searchKeys.map((k) => r[k] ?? "").join(" ").toLowerCase().includes(q));
    }
    for (const f of filters || []) {
      const v = filterValues[f.key];
      if (v) out = out.filter((r) => f.getValue(r) === v);
    }
    return out;
    // `filters` and `searchKeys` are inline literals at every call site, so
    // depending on them would invalidate this memo on every render — the
    // exact bug this comment exists to prevent reintroducing. Their
    // *contents* are static per call site; only the selected values change,
    // and those are in filterValues.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, deferredQuery, filterValues]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    const getVal = col?.sortValue || ((r) => r[sort.key]);
    return [...filtered].sort((a, b) => {
      const va = getVal(a) ?? "";
      const vb = getVal(b) ?? "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return collator.compare(String(va), String(vb)) * sort.dir;
    });
    // `columns` is intentionally not a dependency: call sites pass it as an
    // inline array literal, so its identity changes every render and
    // including it would defeat this memo entirely (which is what used to
    // happen). Only the *sorted column's* sortValue matters here, and that
    // is keyed by sort.key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort]);

  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_ROW_LIMIT);
  const hiddenCount = sorted.length - visible.length;

  function toggleSort(col) {
    if (col.sortable === false) return;
    setSort((s) => ({ key: col.key, dir: s.key === col.key ? -s.dir : 1 }));
  }

  return (
    <>
      {(searchKeys || filters) && (
        <div className="toolbar">
          {searchKeys && (
            <input
              type="search"
              placeholder={searchPlaceholder || "Search…"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {(filters || []).map((f) => (
            <select
              key={f.key}
              value={filterValues[f.key] || ""}
              onChange={(e) => setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))}
            >
              <option value="">{f.label}</option>
              {f.options.map((opt) => {
                const value = typeof opt === "object" ? opt.value : opt;
                const label = typeof opt === "object" ? opt.label : opt;
                return <option key={value} value={value}>{label}</option>;
              })}
            </select>
          ))}
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={sort.key === c.key ? "sorted" : ""}
                  onClick={() => toggleSort(c)}
                  style={{ cursor: c.sortable === false ? "default" : "pointer" }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? "row-clickable" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.nameCell ? "name-cell" : undefined}>
                    {c.render ? c.render(row) : row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-count">
        {hiddenCount > 0
          ? `Showing ${visible.length.toLocaleString()} of ${sorted.length.toLocaleString()} matching (${rows.length.toLocaleString()} total)`
          : `${sorted.length.toLocaleString()} of ${rows.length.toLocaleString()}`}
        {hiddenCount > 0 && (
          <button type="button" className="btn btn-link-inline" onClick={() => setShowAll(true)}>
            Show all {sorted.length.toLocaleString()}
          </button>
        )}
      </div>
    </>
  );
}
