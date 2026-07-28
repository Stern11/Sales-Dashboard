// Registry of all ABM segments. To add a new vertical: create
// `lib/abm-segments/<name>.js` (copy cpg.js), then add it here — that's the
// only other file that needs touching. This lives outside api/ deliberately:
// Vercel treats every file under api/ as its own route, so shared code and
// data manifests belong in lib/ instead. Static imports (no dynamic
// directory scanning) because Vercel's function bundler needs them.

import * as logistics from "./logistics.js";
import * as healthPersonalCare from "./health-and-personal-care.js";
import * as cpg from "./cpg.js";
import * as fnb from "./fnb.js";

export const SEGMENTS = [logistics, healthPersonalCare, cpg, fnb];

export function findSegment(segmentId) {
  return SEGMENTS.find((s) => s.id === segmentId);
}
