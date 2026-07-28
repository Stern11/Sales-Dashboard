/**
 * items: [{ label, value, sub? }]
 */
export function KpiRow({ items }) {
  return (
    <section className="kpi-row">
      {items.map((k) => (
        <div className="kpi" key={k.label}>
          <div className="label">{k.label}</div>
          <div className="value">{k.value}</div>
          {k.sub ? <div className="sub">{k.sub}</div> : null}
        </div>
      ))}
    </section>
  );
}
