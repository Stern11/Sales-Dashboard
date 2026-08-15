// All SQL for the Demo Calls module lives here — api/demo-calls/** route
// handlers never touch `sql` directly. Mirrors lib/pipeline/queries.js's
// shape/conventions (see that file for the reasoning behind the tagged-
// template/transaction patterns reused here).

import { randomUUID } from "node:crypto";
import { getSql } from "../db.js";
import { blankToNull } from "../sqlValues.js";

const LEAD_COLUMNS = `
  id, company_name, contact_name, email, phone,
  hubspot_contact_id, hubspot_origin_module, status, irrelevant_reason,
  pipeline_lead_id, added_to_pipeline_at, company_scale, source,
  demo_stage_entered_at, created_by, updated_by, created_at, updated_at
`;

// call_date::text — the Neon driver otherwise parses a plain `date` column
// into a JS Date object at local midnight, which then serializes to JSON as
// a full UTC timestamp (e.g. "2026-03-17T18:30:00.000Z" for a date entered
// as 2026-03-18 in a UTC+5:30 zone) — a real date-shifting bug, not just an
// ugly one. Casting to text keeps it a plain, timezone-agnostic "YYYY-MM-DD"
// string end to end, which is also exactly what <input type="date"> expects.
const CALL_COLUMNS = `
  id, lead_id, call_number, call_date::text as call_date, outcome, notes, next_steps, transcript_url,
  created_by, updated_by, created_at, updated_at
`;

/**
 * Per-lead call stats (count, no-show count, most recent call) computed via
 * a lateral join rather than N+1 queries — one round trip for the whole
 * list. `summarize()` below derives the funnel/KPI counts from these fields
 * rather than a separate aggregate query.
 */
export async function listLeads() {
  const sql = getSql();
  const leads = await sql`
    select
      l.id, l.company_name, l.contact_name, l.email, l.phone,
      l.hubspot_contact_id, l.hubspot_origin_module, l.status, l.irrelevant_reason,
      l.pipeline_lead_id, l.added_to_pipeline_at, l.company_scale, l.source,
      l.demo_stage_entered_at, l.created_by, l.updated_by, l.created_at, l.updated_at,
      coalesce(c.call_count, 0) as call_count,
      coalesce(c.no_show_count, 0) as no_show_count,
      coalesce(c.completed_count, 0) as completed_count,
      c.first_call_date,
      c.first_call_outcome,
      c.second_call_outcome,
      c.third_call_outcome,
      c.last_call_date,
      c.last_call_outcome
    from demo_call_leads l
    left join lateral (
      select
        count(*) as call_count,
        count(*) filter (where outcome = 'no_show') as no_show_count,
        count(*) filter (where outcome = 'completed') as completed_count,
        (array_agg(call_date::text order by call_number asc))[1] as first_call_date,
        (array_agg(outcome order by call_number asc))[1] as first_call_outcome,
        (array_agg(outcome order by call_number asc))[2] as second_call_outcome,
        (array_agg(outcome order by call_number asc))[3] as third_call_outcome,
        (array_agg(call_date::text order by call_number desc))[1] as last_call_date,
        (array_agg(outcome order by call_number desc))[1] as last_call_outcome
      from demo_call_logs
      where lead_id = l.id
    ) c on true
    order by l.created_at desc
  `;
  return { leads, summary: summarize(leads) };
}

export function summarize(leads) {
  const active = leads.filter((l) => l.status === "active");
  return {
    total: leads.length,
    awaiting_first_call: active.filter((l) => Number(l.call_count) === 0).length,
    // "Meeting N Done" means call #N *itself* was completed — not merely
    // "N or more calls have been completed somewhere in this lead's history".
    // A lead whose first call was a no-show and second call succeeded has a
    // completed_count of 1, but that completion was call #2, not call #1, so
    // it must not count toward "First Meeting Done" (it does count toward
    // "Second Meeting Done").
    call_1_done: active.filter((l) => l.first_call_outcome === "completed").length,
    call_2_done: active.filter((l) => l.second_call_outcome === "completed").length,
    call_3_done: active.filter((l) => l.third_call_outcome === "completed").length,
    no_shows: leads.reduce((sum, l) => sum + Number(l.no_show_count), 0),
    added_to_pipeline: leads.filter((l) => l.pipeline_lead_id).length,
    irrelevant: leads.filter((l) => l.status === "irrelevant").length,
    by_scale: {
      startup: leads.filter((l) => l.company_scale === "startup").length,
      smb: leads.filter((l) => l.company_scale === "smb").length,
      mid_market: leads.filter((l) => l.company_scale === "mid_market").length,
      enterprise: leads.filter((l) => l.company_scale === "enterprise").length,
      unspecified: leads.filter((l) => !l.company_scale).length,
    },
  };
}

export async function getLeadById(id) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(LEAD_COLUMNS)} from demo_call_leads where id = ${id}`;
  return rows[0] || null;
}

export async function getLeadByHubspotContactId(hubspotContactId) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(LEAD_COLUMNS)} from demo_call_leads where hubspot_contact_id = ${hubspotContactId}`;
  return rows[0] || null;
}

/**
 * Reverse lookup for the Sales Pipeline drawer's "View Demo Call History" —
 * given a pipeline_leads.id, finds the demo_call_leads row (if any) that was
 * handed off to it via linkPipeline(). A lead's full call log survives the
 * pipeline handoff (it's never deleted or copied), so this is how Pipeline
 * surfaces it read-only rather than losing it.
 */
export async function getLeadByPipelineLeadId(pipelineLeadId) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(LEAD_COLUMNS)} from demo_call_leads where pipeline_lead_id = ${pipelineLeadId}`;
  return rows[0] || null;
}

export async function listCalls(leadId) {
  const sql = getSql();
  return sql`select ${sql.unsafe(CALL_COLUMNS)} from demo_call_logs where lead_id = ${leadId} order by call_number asc`;
}

/**
 * Creates a lead and, optionally, its first call log entry in one
 * transaction — the "Log first call" action on a live/untracked HubSpot
 * contact does both in a single round trip rather than create-then-add.
 * IDs are pre-generated (randomUUID) since Neon's HTTP driver can't chain a
 * RETURNING value from one transaction statement into the next.
 */
export async function createLead(fields) {
  const sql = getSql();
  const id = randomUUID();
  const {
    company_name, contact_name, email = null, phone = null,
    hubspot_contact_id = null, hubspot_origin_module = null, company_scale = null, source = null,
    demo_stage_entered_at = null, actor, first_call = null,
  } = fields;

  const statements = [
    sql`
      insert into demo_call_leads (
        id, company_name, contact_name, email, phone,
        hubspot_contact_id, hubspot_origin_module, company_scale, source,
        demo_stage_entered_at, created_by, updated_by
      ) values (
        ${id}, ${company_name}, ${contact_name}, ${email}, ${phone},
        ${hubspot_contact_id}, ${hubspot_origin_module}, ${blankToNull(company_scale)}, ${blankToNull(source)},
        ${demo_stage_entered_at}, ${actor}, ${actor}
      )
      returning ${sql.unsafe(LEAD_COLUMNS)}
    `,
  ];

  if (first_call) {
    const callId = randomUUID();
    const { call_date = null, outcome, notes = null, next_steps = null, transcript_url = null } = first_call;
    statements.push(sql`
      insert into demo_call_logs (
        id, lead_id, call_number, call_date, outcome, notes, next_steps, transcript_url, created_by, updated_by
      ) values (
        ${callId}, ${id}, 1, ${blankToNull(call_date)}, ${outcome}, ${blankToNull(notes)}, ${blankToNull(next_steps)}, ${blankToNull(transcript_url)}, ${actor}, ${actor}
      )
    `);
  }

  const results = await sql.transaction(statements);
  const [[lead]] = results;
  return lead;
}

const EDITABLE_FIELDS = ["company_name", "contact_name", "email", "phone", "company_scale", "source"];

export async function updateLead(id, fields, actor) {
  const sql = getSql();
  const current = await getLeadById(id);
  if (!current) return null;

  const next = { ...current };
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const rows = await sql`
    update demo_call_leads set
      company_name = ${next.company_name},
      contact_name = ${next.contact_name},
      email = ${next.email},
      phone = ${next.phone},
      company_scale = ${blankToNull(next.company_scale)},
      source = ${blankToNull(next.source)},
      updated_by = ${actor},
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(LEAD_COLUMNS)}
  `;
  return rows[0] || null;
}

/** Sets active/irrelevant status. `reason` is only meaningful (and stored) when moving to 'irrelevant'. */
export async function setStatus(id, { status, reason = null, actor }) {
  const sql = getSql();
  const irrelevantReason = status === "irrelevant" ? reason : null;
  const rows = await sql`
    update demo_call_leads set
      status = ${status},
      irrelevant_reason = ${irrelevantReason},
      updated_by = ${actor},
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(LEAD_COLUMNS)}
  `;
  return rows[0] || null;
}

/** Records that a lead was copied into Sales Pipeline — called after the frontend's own POST /api/pipeline succeeds. */
export async function linkPipeline(id, pipelineLeadId, actor) {
  const sql = getSql();
  const rows = await sql`
    update demo_call_leads set
      pipeline_lead_id = ${pipelineLeadId},
      added_to_pipeline_at = now(),
      updated_by = ${actor},
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(LEAD_COLUMNS)}
  `;
  return rows[0] || null;
}

/**
 * Appends a call log entry, numbering it 1, 2, 3, ... within its lead.
 *
 * `call_number` is derived in the INSERT itself rather than by a preceding
 * `select count(*)`. The old read-then-write spanned two HTTP round trips,
 * so two people clicking "log a call" at once both read the same count and
 * both wrote call #3 — which silently corrupted the positional aggregation
 * in listLeads (`array_agg(outcome order by call_number)[1..3]`) and the
 * first/second/third-call KPIs built on it. The unique index added in
 * migration 0013 is the backstop: if two inserts still collide, one fails
 * with 23505 and surfaces as a 409 rather than duplicating.
 */
export async function addCall(leadId, fields, actor) {
  const sql = getSql();
  const id = randomUUID();
  const { call_date = null, outcome, notes = null, next_steps = null, transcript_url = null } = fields;

  const [[call]] = await sql.transaction([
    sql`
      insert into demo_call_logs (
        id, lead_id, call_number, call_date, outcome, notes, next_steps, transcript_url, created_by, updated_by
      ) values (
        ${id}, ${leadId},
        (select coalesce(max(call_number), 0) + 1 from demo_call_logs where lead_id = ${leadId}),
        ${blankToNull(call_date)}, ${outcome}, ${blankToNull(notes)}, ${blankToNull(next_steps)}, ${blankToNull(transcript_url)}, ${actor}, ${actor}
      )
      returning ${sql.unsafe(CALL_COLUMNS)}
    `,
    sql`update demo_call_leads set updated_by = ${actor}, updated_at = now() where id = ${leadId}`,
  ]);
  return call;
}

const EDITABLE_CALL_FIELDS = ["call_date", "outcome", "notes", "next_steps", "transcript_url"];

export async function updateCall(leadId, callId, fields, actor) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(CALL_COLUMNS)} from demo_call_logs where id = ${callId} and lead_id = ${leadId}`;
  const current = rows[0];
  if (!current) return null;

  const next = { ...current };
  for (const key of EDITABLE_CALL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const [[call]] = await sql.transaction([
    sql`
      update demo_call_logs set
        call_date = ${blankToNull(next.call_date)},
        outcome = ${next.outcome},
        notes = ${blankToNull(next.notes)},
        next_steps = ${blankToNull(next.next_steps)},
        transcript_url = ${blankToNull(next.transcript_url)},
        updated_by = ${actor},
        updated_at = now()
      where id = ${callId} and lead_id = ${leadId}
      returning ${sql.unsafe(CALL_COLUMNS)}
    `,
    sql`update demo_call_leads set updated_by = ${actor}, updated_at = now() where id = ${leadId}`,
  ]);
  return call;
}

/** Permanently deletes a lead. Call logs cascade automatically (on delete cascade). No undo. */
export async function deleteLead(id) {
  const sql = getSql();
  const rows = await sql`delete from demo_call_leads where id = ${id} returning id`;
  return rows[0] || null;
}
