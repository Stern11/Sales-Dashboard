// GET /api/segments — lists ABM segments that have data, driving the
// frontend's segment tabs. Segments with an empty roster (not yet populated,
// e.g. CPG/F&B before their lead lists are filled in) are omitted.

import { SEGMENTS } from "../lib/abm-segments/index.js";

export default function handler(req, res) {
  const active = SEGMENTS.filter((s) => s.leads.length > 0).map((s) => ({
    id: s.id,
    label: s.label,
    num_companies: s.companies.length,
    num_leads: s.leads.length,
  }));
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.status(200).json({ segments: active });
}
