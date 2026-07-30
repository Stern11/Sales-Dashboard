import { useMemo, useState } from "react";

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
  const [filterValues, setFilterValues] = useState({});
  const [sort, setSort] = useState(defaultSort || { key: columns[0]?.key, dir: 1 });

  const filtered = useMemo(() => {
    let out = rows;
    if (searchKeys && query) {
      const q = query.toLowerCase();
      out = out.filter((r) => searchKeys.map((k) => r[k] ?? "").join(" ").toLowerCase().includes(q));
    }
    for (const f of filters || []) {
      const v = filterValues[f.key];
      if (v) out = out.filter((r) => f.getValue(r) === v);
    }
    return out;
  }, [rows, query, filterValues, searchKeys, filters]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    const getVal = col?.sortValue || ((r) => r[sort.key]);
    return [...filtered].sort((a, b) => {
      const va = getVal(a) ?? "";
      const vb = getVal(b) ?? "";
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * sort.dir;
      return String(va).localeCompare(String(vb)) * sort.dir;
    });
  }, [filtered, sort, columns]);

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
            {sorted.map((row) => (
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
      <div className="row-count">{sorted.length} of {rows.length}</div>
    </>
  );
}
