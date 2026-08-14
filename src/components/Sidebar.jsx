import { NavLink } from "react-router-dom";
import { useTheme } from "../hooks/useTheme.js";
import { useSidebar } from "../hooks/useSidebar.js";
import { useAuthContext } from "../context/AuthContext.jsx";

// `short` is what's shown when collapsed (initials, not an icon — the app
// has no icon set, and unicode glyphs elsewhere here are single characters;
// initials read better at this width than truncated text). Exported so
// App.jsx can derive the current page's heading from the same source of
// truth instead of a second hardcoded route/label list.
export const MODULES = [
  { to: "/overview", label: "Overview", short: "OV" },
  { to: "/pipeline", label: "Sales Pipeline", short: "SP" },
  { to: "/demo-calls", label: "Meetings", short: "ME" },
  { to: "/marketing", label: "Performance Marketing", short: "PM" },
  { to: "/abm", label: "ABM Outreach", short: "AO" },
  { to: "/expansion", label: "Account Expansion", short: "AE" },
];

/**
 * Left sidebar — module nav, replacing the old horizontal tab bar
 * (module-nav) now that the app has grown past a handful of tabs
 * comfortably fitting in one row. Collapsible (icon/initials-only, persisted
 * in localStorage same as theme), expanded by default.
 */
export function Sidebar() {
  const { theme, toggle } = useTheme();
  const { collapsed, toggle: toggleCollapsed } = useSidebar();
  const { name, email, logout } = useAuthContext();

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div>
            <div className="sidebar-title">Executive Sales Dashboard</div>
            <p className="subtitle">Live from HubSpot</p>
          </div>
        )}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <nav className="sidebar-nav">
        {MODULES.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            className={({ isActive }) => (isActive ? "active" : "")}
            title={collapsed ? m.label : undefined}
          >
            {collapsed ? m.short : m.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-user" title={email || undefined}>
            <div className="sidebar-user-name">{name || email}</div>
            {email && name && <div className="sidebar-user-email">{email}</div>}
          </div>
        )}
        <button className="btn" type="button" onClick={toggle} title={collapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}>
          {collapsed ? (theme === "dark" ? "☀" : "🌙") : (theme === "dark" ? "Light mode" : "Dark mode")}
        </button>
        <button className="btn" type="button" onClick={logout} title={collapsed ? "Log out" : undefined}>
          {collapsed ? "⎋" : "Log out"}
        </button>
      </div>
    </aside>
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
