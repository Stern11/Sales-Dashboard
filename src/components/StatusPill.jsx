const VARIANTS = {
  ready: "pill-ready",
  missing: "pill-missing",
  notstarted: "pill-notstarted",
  stage: "pill-stage",
  cold: "pill-cold",
  lost: "pill-lost",
  supplychain: "pill-supplychain",
};

/**
 * `color`, when passed, overrides `variant`'s fixed palette with a solid
 * badge in that exact color — used for stage pills, which already have a
 * distinct color per stage (STAGES in constants.js, the same values driving
 * the funnel chart bars and kanban column headers) that the fixed variant
 * classes don't capture (discovery/proposal/commercial all share the
 * generic "stage" variant otherwise). `color` is a CSS var() reference, not
 * a literal hex, so it's used as-is rather than alpha-blended.
 */
export function StatusPill({ variant, color, children }) {
  if (color) {
    return (
      <span className="pill" style={{ background: color, color: "#fff" }}>
        {children}
      </span>
    );
  }
  return <span className={`pill ${VARIANTS[variant] || VARIANTS.stage}`}>{children}</span>;
}
