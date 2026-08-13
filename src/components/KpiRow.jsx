/**
 * items: [{ label, value, sub?, onClick?, active? }]
 * onClick/active are both optional — a card only becomes an interactive
 * filter toggle when its item provides onClick (existing callers that don't
 * pass it get the plain, unclickable card exactly as before).
 */
export function KpiRow({ items }) {
  return (
    <section className="kpi-row">
      {items.map((k) => (
        <div
          className={`kpi${k.onClick ? " kpi-clickable" : ""}${k.active ? " kpi-active" : ""}`}
          key={k.label}
          onClick={k.onClick}
          role={k.onClick ? "button" : undefined}
          tabIndex={k.onClick ? 0 : undefined}
          onKeyDown={k.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); k.onClick(); } } : undefined}
        >
          <div className="label">{k.label}</div>
          <div className="value">{k.value}</div>
          {k.sub ? <div className="sub">{k.sub}</div> : null}
        </div>
      ))}
    </section>
  );
}
