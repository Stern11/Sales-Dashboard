// All SQL for the Sales Pipeline module lives here — the API route handlers
// (api/pipeline/**) call these functions and never touch `sql` directly.
// Every value passed through the driver's tagged-template `sql` is
// auto-parameterized (no manual escaping, no injection risk).

import { randomUUID } from "node:crypto";
import { getSql } from "../db.js";
import { SourceLockedError } from "./errors.js";
import { blankToNull } from "../sqlValues.js";
import { STAGES, isActiveStage } from "./constants.js";

const LEAD_COLUMNS = `
  id, company_name, contact_name, email, phone, source, source_locked,
  hubspot_contact_id, hubspot_origin_module, company_scale, region, is_supply_chain,
  priority, deal_size, project_description, stage, prior_active_stage, cold_lost_reason,
  created_by, updated_by, created_at, updated_at
`;

export function summarize(leads) {
  const by_stage = Object.fromEntries(STAGES.map((s) => [s.value, 0]));
  let open_pipeline_value = 0;
  let closed_won_value = 0;
  for (const lead of leads) {
    by_stage[lead.stage] = (by_stage[lead.stage] || 0) + 1;
    if (isActiveStage(lead.stage)) open_pipeline_value += Number(lead.deal_size) || 0;
    if (lead.stage === "won") closed_won_value += Number(lead.deal_size) || 0;
  }
  return { total: leads.length, by_stage, open_pipeline_value, closed_won_value };
}

// won_at: the most recent time a lead moved *into* 'won' — not created_at,
// so a lead's won value lands in the quarter it actually closed, not the
// quarter it was first added to the pipeline (see the Overview page's
// quarterly trend, the one consumer of this field). "Most recent" (not
// first) handles a lead that won, got reopened, and won again.
export async function listLeads() {
  const sql = getSql();
  const leads = await sql`
    select ${sql.unsafe(LEAD_COLUMNS)},
      (
        select h.changed_at from pipeline_lead_stage_history h
        where h.lead_id = pipeline_leads.id and h.to_stage = 'won'
        order by h.changed_at desc limit 1
      ) as won_at
    from pipeline_leads
    order by updated_at desc
  `;
  return { leads, summary: summarize(leads) };
}

export async function getLeadById(id) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(LEAD_COLUMNS)} from pipeline_leads where id = ${id}`;
  return rows[0] || null;
}

export async function listNotes(leadId) {
  const sql = getSql();
  return sql`select id, lead_id, body, author, tagged_emails, created_at from pipeline_lead_notes where lead_id = ${leadId} order by created_at desc`;
}

export async function listStageHistory(leadId) {
  const sql = getSql();
  return sql`select id, lead_id, from_stage, to_stage, reason, changed_by, changed_at from pipeline_lead_stage_history where lead_id = ${leadId} order by changed_at asc`;
}

/**
 * Creates a lead and its initial stage_history row ('sql', the only allowed
 * starting stage) in one transaction. The id is generated here (rather than
 * left to the column default) so both statements in the transaction can
 * reference it — Neon's HTTP driver transactions can't chain a RETURNING
 * value from one statement into the next.
 */
export async function createLead(fields) {
  const sql = getSql();
  const id = randomUUID();
  const historyId = randomUUID();
  const {
    company_name, contact_name, email = null, phone = null, source,
    source_locked = false, hubspot_contact_id = null, hubspot_origin_module = null,
    company_scale = null, region = null, is_supply_chain = false, priority = "medium", deal_size = null,
    project_description = null, actor,
  } = fields;

  const [[lead]] = await sql.transaction([
    sql`
      insert into pipeline_leads (
        id, company_name, contact_name, email, phone, source, source_locked,
        hubspot_contact_id, hubspot_origin_module, company_scale, region, is_supply_chain, priority,
        deal_size, project_description, stage, created_by, updated_by
      ) values (
        ${id}, ${company_name}, ${contact_name}, ${email}, ${phone}, ${source}, ${source_locked},
        ${hubspot_contact_id}, ${hubspot_origin_module}, ${company_scale}, ${region}, ${is_supply_chain}, ${priority},
        ${deal_size}, ${project_description}, 'sql', ${actor}, ${actor}
      )
      returning ${sql.unsafe(LEAD_COLUMNS)}
    `,
    sql`
      insert into pipeline_lead_stage_history (id, lead_id, from_stage, to_stage, reason, changed_by)
      values (${historyId}, ${id}, null, 'sql', null, ${actor})
    `,
  ]);
  return lead;
}

const EDITABLE_FIELDS = [
  "company_name", "contact_name", "email", "phone", "source", "company_scale", "region",
  "is_supply_chain", "priority", "deal_size", "project_description",
];

// Defined in errors.js (so respond.js can map it without importing this
// module) and re-exported here, where callers already expect to find it.
export { SourceLockedError };

/** Edits lead fields only — stage changes always go through changeStage() so history is never bypassed. */
export async function updateLead(id, fields, actor) {
  const sql = getSql();
  const current = await getLeadById(id);
  if (!current) return null;
  if (current.source_locked && Object.prototype.hasOwnProperty.call(fields, "source") && fields.source !== current.source) {
    throw new SourceLockedError("This lead's source was set automatically and can't be edited.");
  }

  const next = { ...current };
  for (const key of EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const rows = await sql`
    update pipeline_leads set
      -- company_name / contact_name / source are NOT NULL (db/schema.sql), so
      -- they are deliberately NOT passed through blankToNull: the form
      -- already requires them, and mapping "" to null here would turn a
      -- client-side validation gap into a constraint violation.
      company_name = ${next.company_name},
      contact_name = ${next.contact_name},
      email = ${blankToNull(next.email)},
      phone = ${blankToNull(next.phone)},
      source = ${next.source},
      company_scale = ${blankToNull(next.company_scale)},
      region = ${blankToNull(next.region)},
      is_supply_chain = ${next.is_supply_chain},
      priority = ${next.priority},
      deal_size = ${blankToNull(next.deal_size)},
      project_description = ${blankToNull(next.project_description)},
      updated_by = ${actor},
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(LEAD_COLUMNS)}
  `;
  return rows[0] || null;
}

/**
 * Moves a lead to `to_stage`, writing one stage_history row. Handles the
 * cold/lost branching rules: active → cold/lost records `prior_active_stage`
 * + optional `reason`; cold/lost → active (revive) clears both.
 */
export async function changeStage(id, { to_stage, reason = null, actor }) {
  const sql = getSql();
  const current = await getLeadById(id);
  if (!current) return null;

  const from_stage = current.stage;
  const movingToInactive = to_stage === "cold" || to_stage === "lost";
  const priorActiveStage = movingToInactive ? from_stage : null;
  const coldLostReason = movingToInactive ? reason : null;
  const historyId = randomUUID();

  const [[lead]] = await sql.transaction([
    sql`
      update pipeline_leads set
        stage = ${to_stage},
        prior_active_stage = ${priorActiveStage},
        cold_lost_reason = ${coldLostReason},
        updated_by = ${actor},
        updated_at = now()
      where id = ${id}
      returning ${sql.unsafe(LEAD_COLUMNS)}
    `,
    sql`
      insert into pipeline_lead_stage_history (id, lead_id, from_stage, to_stage, reason, changed_by)
      values (${historyId}, ${id}, ${from_stage}, ${to_stage}, ${reason}, ${actor})
    `,
  ]);
  return lead;
}

export async function addNote(leadId, { body, author, tagged_emails = [] }) {
  const sql = getSql();
  const id = randomUUID();
  const [[note]] = await sql.transaction([
    sql`
      insert into pipeline_lead_notes (id, lead_id, body, author, tagged_emails)
      values (${id}, ${leadId}, ${body}, ${author}, ${tagged_emails}::text[])
      returning id, lead_id, body, author, tagged_emails, created_at
    `,
    sql`update pipeline_leads set updated_by = ${author}, updated_at = now() where id = ${leadId}`,
  ]);
  return note;
}

/**
 * Permanently deletes a lead. Notes and stage history cascade automatically
 * (`on delete cascade` in db/schema.sql) — nothing else to clean up here.
 * The API layer requires the caller to have typed the lead's company name
 * back to confirm before this is ever called; there's no undo.
 */
export async function deleteLead(id) {
  const sql = getSql();
  const rows = await sql`delete from pipeline_leads where id = ${id} returning id`;
  return rows[0] || null;
}

/** Bulk "already in pipeline" lookup by HubSpot contact id, used by the ABM/Marketing retrofit. */
export async function checkContactIds(contactIds) {
  const sql = getSql();
  if (!contactIds.length) return [];
  return sql`select hubspot_contact_id, id, stage from pipeline_leads where hubspot_contact_id = any(${contactIds})`;
}
