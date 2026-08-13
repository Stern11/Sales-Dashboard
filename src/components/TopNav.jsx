import { NavLink } from "react-router-dom";
import { useTheme } from "../hooks/useTheme.js";

const MODULES = [
  { to: "/pipeline", label: "Sales Pipeline" },
  { to: "/demo-calls", label: "Meetings" },
  { to: "/marketing", label: "Performance Marketing" },
  { to: "/abm", label: "ABM Outreach" },
];

export function TopNav() {
  const { theme, toggle } = useTheme();
  return (
    <>
      <header className="top">
        <div>
          <h1>Stakeholder Dashboard</h1>
          <p className="subtitle">Live from HubSpot</p>
        </div>
        <div className="meta">
          <button className="btn" type="button" onClick={toggle}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </header>
      <nav className="module-nav">
        {MODULES.map((m) => (
          <NavLink key={m.to} to={m.to} className={({ isActive }) => (isActive ? "active" : "")}>
            {m.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

/**
 * Per-page "Updated: … / Refresh now" strip — each module owns its own
 * data, so its own freshness meta. Always right-aligned, so the button
 * lands in the same spot (top-right) on every module regardless of whether
 * a given page happens to pair it with another toolbar control (a period
 * toggle, a section heading) or renders it standalone — the flex alignment
 * lives here rather than depending on each page's own wrapper. `style` lets
 * a caller that's nesting this inside its own flex row (e.g. beside an
 * `<h2>`) override the default marginBottom so it doesn't throw off that
 * row's own vertical centering.
 */
export function PageMeta({ lastUpdated, onRefresh, style }) {
  return (
    <div className="meta" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginBottom: 18, ...style }}>
      {lastUpdated && (
        <span>
          Updated: {new Date(lastUpdated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </span>
      )}
      <button className="btn" type="button" onClick={onRefresh}>Refresh now</button>
    </div>
  );
}
