const VARIANTS = {
  ready: "pill-ready",
  missing: "pill-missing",
  notstarted: "pill-notstarted",
  stage: "pill-stage",
};

export function StatusPill({ variant, children }) {
  return <span className={`pill ${VARIANTS[variant] || VARIANTS.stage}`}>{children}</span>;
}
