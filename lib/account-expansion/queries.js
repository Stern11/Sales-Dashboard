// All SQL for the Account Expansion module lives here — api/account-expansion/**
// route handlers never touch `sql` directly. Mirrors lib/demo-calls/queries.js's
// shape/conventions (see that file for the reasoning behind the patterns
// reused here: blankToNull, EDITABLE_FIELDS diffing, etc.).

import { randomUUID } from "node:crypto";
import { getSql } from "../db.js";
import { blankToNull } from "../sqlValues.js";

const ACCOUNT_COLUMNS = `
  id, hubspot_company_id, company_name, segment_id, expansion_outlook,
  footprint_use_case, footprint_function, footprint_geography, footprint_value,
  footprint_start_date::text as footprint_start_date, footprint_stakeholder, footprint_notes,
  last_researched_at, created_by, updated_by, created_at, updated_at
`;

const AREA_COLUMNS = `
  id, account_id, area, use_case, why_relevant, status, relevance,
  needs_validation, notes, archived, created_by, updated_by, created_at, updated_at
`;

const WHITESPACE_COLUMNS = `
  id, account_id, area, status, created_by, updated_by, created_at, updated_at
`;

const SIGNAL_COLUMNS = `
  id, account_id, signal_date::text as signal_date, signal_type, finding, source_url,
  expansion_area_id, notes, created_by, updated_by, created_at, updated_at
`;

const STAKEHOLDER_COLUMNS = `
  id, account_id, name, title, function, relationship, expansion_area_id,
  notes, created_by, updated_by, created_at, updated_at
`;

const QUESTION_COLUMNS = `
  id, account_id, question, expansion_area_id, priority, answer,
  created_by, updated_by, created_at, updated_at
`;

/**
 * Portfolio view — every account with a research shell so far, plus enough
 * aggregated detail (lateral joins, same one-round-trip approach as
 * lib/demo-calls/queries.js's listLeads()) to power the Accounts table's
 * chips and the ABM dashboard's expansion KPIs without N+1 queries.
 */
export async function listAccounts() {
  const sql = getSql();
  return sql`
    select
      a.id, a.hubspot_company_id, a.company_name, a.segment_id, a.expansion_outlook,
      a.footprint_use_case, a.last_researched_at, a.updated_at,
      coalesce(areas.area_names, '{}') as area_names,
      coalesce(areas.area_count, 0) as area_count,
      coalesce(areas.validated_count, 0) as validated_count,
      latest_signal.finding as latest_signal_finding,
      latest_signal.signal_date::text as latest_signal_date
    from account_expansion a
    left join lateral (
      select
        array_agg(area order by created_at asc) as area_names,
        count(*) as area_count,
        count(*) filter (where status = 'validated') as validated_count
      from account_expansion_areas
      where account_id = a.id and archived = false
    ) areas on true
    left join lateral (
      select finding, signal_date
      from account_expansion_signals
      where account_id = a.id
      order by signal_date desc, created_at desc
      limit 1
    ) latest_signal on true
    order by a.updated_at desc
  `;
}

export async function getAccountById(id) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(ACCOUNT_COLUMNS)} from account_expansion where id = ${id}`;
  return rows[0] || null;
}

/**
 * Creates a new account's planning shell — this module owns its own roster
 * (existing clients Heizen is trying to expand within), not sourced from any
 * external list, so a rep explicitly adds one via "+ Add Account" rather
 * than it being lazily created on first view.
 */
export async function createAccount({ company_name, segment_id = null }, actor) {
  const sql = getSql();
  const id = randomUUID();
  const rows = await sql`
    insert into account_expansion (id, company_name, segment_id, created_by, updated_by)
    values (${id}, ${company_name}, ${blankToNull(segment_id)}, ${actor}, ${actor})
    returning ${sql.unsafe(ACCOUNT_COLUMNS)}
  `;
  return rows[0];
}

/** Children cascade via each child table's `on delete cascade` FK — no separate cleanup needed. */
export async function deleteAccount(id) {
  const sql = getSql();
  const rows = await sql`delete from account_expansion where id = ${id} returning company_name`;
  return rows[0] || null;
}

/** Full detail for one account's Expansion drawer — everything in one round trip. */
export async function getAccountDetail(id) {
  const sql = getSql();
  const [account, areas, whitespace, signals, stakeholders, questions] = await Promise.all([
    getAccountById(id),
    sql`select ${sql.unsafe(AREA_COLUMNS)} from account_expansion_areas where account_id = ${id} order by created_at asc`,
    sql`select ${sql.unsafe(WHITESPACE_COLUMNS)} from account_expansion_whitespace where account_id = ${id} order by created_at asc`,
    sql`select ${sql.unsafe(SIGNAL_COLUMNS)} from account_expansion_signals where account_id = ${id} order by signal_date desc, created_at desc`,
    sql`select ${sql.unsafe(STAKEHOLDER_COLUMNS)} from account_expansion_stakeholders where account_id = ${id} order by created_at asc`,
    sql`select ${sql.unsafe(QUESTION_COLUMNS)} from account_expansion_questions where account_id = ${id} order by created_at asc`,
  ]);
  return { account, areas, whitespace, signals, stakeholders, questions };
}

const FOOTPRINT_FIELDS = [
  "expansion_outlook", "footprint_use_case", "footprint_function", "footprint_geography",
  "footprint_value", "footprint_start_date", "footprint_stakeholder", "footprint_notes",
];

export async function updateAccountFootprint(id, fields, actor) {
  const sql = getSql();
  const current = await getAccountById(id);
  if (!current) return null;

  const next = { ...current };
  for (const key of FOOTPRINT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const rows = await sql`
    update account_expansion set
      expansion_outlook = ${blankToNull(next.expansion_outlook)},
      footprint_use_case = ${blankToNull(next.footprint_use_case)},
      footprint_function = ${blankToNull(next.footprint_function)},
      footprint_geography = ${blankToNull(next.footprint_geography)},
      footprint_value = ${next.footprint_value === "" || next.footprint_value == null ? null : Number(next.footprint_value)},
      footprint_start_date = ${blankToNull(next.footprint_start_date)},
      footprint_stakeholder = ${blankToNull(next.footprint_stakeholder)},
      footprint_notes = ${blankToNull(next.footprint_notes)},
      updated_by = ${actor},
      updated_at = now()
    where id = ${id}
    returning ${sql.unsafe(ACCOUNT_COLUMNS)}
  `;
  return rows[0] || null;
}

// ---- Expansion Areas ----

export async function createArea(accountId, fields, actor) {
  const sql = getSql();
  const id = randomUUID();
  const { area, use_case = null, why_relevant = null, status = "idea", relevance = "medium", needs_validation = null, notes = null } = fields;
  const rows = await sql`
    insert into account_expansion_areas (
      id, account_id, area, use_case, why_relevant, status, relevance, needs_validation, notes, created_by, updated_by
    ) values (
      ${id}, ${accountId}, ${area}, ${blankToNull(use_case)}, ${blankToNull(why_relevant)}, ${status}, ${relevance},
      ${blankToNull(needs_validation)}, ${blankToNull(notes)}, ${actor}, ${actor}
    )
    returning ${sql.unsafe(AREA_COLUMNS)}
  `;
  return rows[0];
}

const AREA_EDITABLE_FIELDS = ["area", "use_case", "why_relevant", "status", "relevance", "needs_validation", "notes", "archived"];

export async function updateArea(accountId, areaId, fields, actor) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(AREA_COLUMNS)} from account_expansion_areas where id = ${areaId} and account_id = ${accountId}`;
  const current = rows[0];
  if (!current) return null;

  const next = { ...current };
  for (const key of AREA_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const [[area]] = await sql.transaction([
    sql`
      update account_expansion_areas set
        area = ${next.area},
        use_case = ${blankToNull(next.use_case)},
        why_relevant = ${blankToNull(next.why_relevant)},
        status = ${next.status},
        relevance = ${next.relevance},
        needs_validation = ${blankToNull(next.needs_validation)},
        notes = ${blankToNull(next.notes)},
        archived = ${!!next.archived},
        updated_by = ${actor},
        updated_at = now()
      where id = ${areaId} and account_id = ${accountId}
      returning ${sql.unsafe(AREA_COLUMNS)}
    `,
    sql`update account_expansion set updated_by = ${actor}, updated_at = now() where id = ${accountId}`,
  ]);
  return area;
}

// ---- Whitespace ----

/** Insert-or-update-by-area — matches the (account_id, area) unique index, so re-setting an existing area's status just overwrites it rather than duplicating. */
export async function upsertWhitespace(accountId, { area, status }, actor) {
  const sql = getSql();
  const rows = await sql`
    insert into account_expansion_whitespace (id, account_id, area, status, created_by, updated_by)
    values (${randomUUID()}, ${accountId}, ${area}, ${status}, ${actor}, ${actor})
    on conflict (account_id, area) do update set
      status = excluded.status,
      updated_by = excluded.updated_by,
      updated_at = now()
    returning ${sql.unsafe(WHITESPACE_COLUMNS)}
  `;
  return rows[0];
}

export async function deleteWhitespace(accountId, whitespaceId) {
  const sql = getSql();
  const rows = await sql`delete from account_expansion_whitespace where id = ${whitespaceId} and account_id = ${accountId} returning id`;
  return rows[0] || null;
}

// ---- Research Signals ----

export async function createSignal(accountId, fields, actor) {
  const sql = getSql();
  const id = randomUUID();
  const { signal_date, signal_type, finding, source_url = null, expansion_area_id = null, notes = null } = fields;
  const [[signal]] = await sql.transaction([
    sql`
      insert into account_expansion_signals (
        id, account_id, signal_date, signal_type, finding, source_url, expansion_area_id, notes, created_by, updated_by
      ) values (
        ${id}, ${accountId}, ${signal_date}, ${signal_type}, ${finding}, ${blankToNull(source_url)},
        ${blankToNull(expansion_area_id)}, ${blankToNull(notes)}, ${actor}, ${actor}
      )
      returning ${sql.unsafe(SIGNAL_COLUMNS)}
    `,
    // Adding a signal *is* researching — bumps "Last Researched" without a separate manual control.
    sql`update account_expansion set last_researched_at = now(), updated_by = ${actor}, updated_at = now() where id = ${accountId}`,
  ]);
  return signal;
}

const SIGNAL_EDITABLE_FIELDS = ["signal_date", "signal_type", "finding", "source_url", "expansion_area_id", "notes"];

export async function updateSignal(accountId, signalId, fields, actor) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(SIGNAL_COLUMNS)} from account_expansion_signals where id = ${signalId} and account_id = ${accountId}`;
  const current = rows[0];
  if (!current) return null;

  const next = { ...current };
  for (const key of SIGNAL_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const [[signal]] = await sql.transaction([
    sql`
      update account_expansion_signals set
        signal_date = ${next.signal_date},
        signal_type = ${next.signal_type},
        finding = ${next.finding},
        source_url = ${blankToNull(next.source_url)},
        expansion_area_id = ${blankToNull(next.expansion_area_id)},
        notes = ${blankToNull(next.notes)},
        updated_by = ${actor},
        updated_at = now()
      where id = ${signalId} and account_id = ${accountId}
      returning ${sql.unsafe(SIGNAL_COLUMNS)}
    `,
    sql`update account_expansion set updated_by = ${actor}, updated_at = now() where id = ${accountId}`,
  ]);
  return signal;
}

export async function deleteSignal(accountId, signalId) {
  const sql = getSql();
  const rows = await sql`delete from account_expansion_signals where id = ${signalId} and account_id = ${accountId} returning id`;
  return rows[0] || null;
}

// ---- Stakeholders ----

export async function createStakeholder(accountId, fields, actor) {
  const sql = getSql();
  const id = randomUUID();
  const { name = null, title = null, function: fn = null, relationship = "unknown", expansion_area_id = null, notes = null } = fields;
  const rows = await sql`
    insert into account_expansion_stakeholders (
      id, account_id, name, title, function, relationship, expansion_area_id, notes, created_by, updated_by
    ) values (
      ${id}, ${accountId}, ${blankToNull(name)}, ${blankToNull(title)}, ${blankToNull(fn)}, ${relationship},
      ${blankToNull(expansion_area_id)}, ${blankToNull(notes)}, ${actor}, ${actor}
    )
    returning ${sql.unsafe(STAKEHOLDER_COLUMNS)}
  `;
  return rows[0];
}

const STAKEHOLDER_EDITABLE_FIELDS = ["name", "title", "function", "relationship", "expansion_area_id", "notes"];

export async function updateStakeholder(accountId, stakeholderId, fields, actor) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(STAKEHOLDER_COLUMNS)} from account_expansion_stakeholders where id = ${stakeholderId} and account_id = ${accountId}`;
  const current = rows[0];
  if (!current) return null;

  const next = { ...current };
  for (const key of STAKEHOLDER_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const [[stakeholder]] = await sql.transaction([
    sql`
      update account_expansion_stakeholders set
        name = ${blankToNull(next.name)},
        title = ${blankToNull(next.title)},
        function = ${blankToNull(next.function)},
        relationship = ${next.relationship},
        expansion_area_id = ${blankToNull(next.expansion_area_id)},
        notes = ${blankToNull(next.notes)},
        updated_by = ${actor},
        updated_at = now()
      where id = ${stakeholderId} and account_id = ${accountId}
      returning ${sql.unsafe(STAKEHOLDER_COLUMNS)}
    `,
    sql`update account_expansion set updated_by = ${actor}, updated_at = now() where id = ${accountId}`,
  ]);
  return stakeholder;
}

export async function deleteStakeholder(accountId, stakeholderId) {
  const sql = getSql();
  const rows = await sql`delete from account_expansion_stakeholders where id = ${stakeholderId} and account_id = ${accountId} returning id`;
  return rows[0] || null;
}

// ---- Open Questions ----

export async function createQuestion(accountId, fields, actor) {
  const sql = getSql();
  const id = randomUUID();
  const { question, expansion_area_id = null, priority = "medium", answer = null } = fields;
  const rows = await sql`
    insert into account_expansion_questions (
      id, account_id, question, expansion_area_id, priority, answer, created_by, updated_by
    ) values (
      ${id}, ${accountId}, ${question}, ${blankToNull(expansion_area_id)}, ${priority}, ${blankToNull(answer)}, ${actor}, ${actor}
    )
    returning ${sql.unsafe(QUESTION_COLUMNS)}
  `;
  return rows[0];
}

const QUESTION_EDITABLE_FIELDS = ["question", "expansion_area_id", "priority", "answer"];

export async function updateQuestion(accountId, questionId, fields, actor) {
  const sql = getSql();
  const rows = await sql`select ${sql.unsafe(QUESTION_COLUMNS)} from account_expansion_questions where id = ${questionId} and account_id = ${accountId}`;
  const current = rows[0];
  if (!current) return null;

  const next = { ...current };
  for (const key of QUESTION_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) next[key] = fields[key];
  }

  const [[question]] = await sql.transaction([
    sql`
      update account_expansion_questions set
        question = ${next.question},
        expansion_area_id = ${blankToNull(next.expansion_area_id)},
        priority = ${next.priority},
        answer = ${blankToNull(next.answer)},
        updated_by = ${actor},
        updated_at = now()
      where id = ${questionId} and account_id = ${accountId}
      returning ${sql.unsafe(QUESTION_COLUMNS)}
    `,
    sql`update account_expansion set updated_by = ${actor}, updated_at = now() where id = ${accountId}`,
  ]);
  return question;
}

export async function deleteQuestion(accountId, questionId) {
  const sql = getSql();
  const rows = await sql`delete from account_expansion_questions where id = ${questionId} and account_id = ${accountId} returning id`;
  return rows[0] || null;
}
