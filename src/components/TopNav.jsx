import { NavLink } from "react-router-dom";
import { useTheme } from "../hooks/useTheme.js";

const MODULES = [
  { to: "/abm", label: "ABM Outreach" },
  { to: "/pipeline", label: "Sales Pipeline" },
  { to: "/sources", label: "Lead Sources" },
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

/** Per-page "Updated: … / Refresh now" strip — each module owns its own data, so its own freshness meta. */
export function PageMeta({ lastUpdated, onRefresh }) {
  return (
    <div className="meta" style={{ textAlign: "left", marginBottom: 18 }}>
      {lastUpdated && (
        <span>
          Updated: {new Date(lastUpdated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </span>
      )}
      <button className="btn" type="button" onClick={onRefresh}>Refresh now</button>
    </div>
  );
}
