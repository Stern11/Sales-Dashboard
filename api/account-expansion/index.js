// Every Account Expansion route, disambiguated by method + `?action=` +
// `?item_id=` — deliberately one file (not a REST-y tree of subresource
// files) to stay within Vercel Hobby's 12-serverless-function-per-deployment
// cap, same reasoning as api/demo-calls/[id].js (see that file's comment)
// — this app was already sitting at 11 functions before this module.
//
//   GET    /api/account-expansion                                    — portfolio list (+ dashboard KPIs)
//   POST   /api/account-expansion                                    — create a new account's planning shell, returns full detail
//   GET    /api/account-expansion?id=X                                — full detail (account + areas + whitespace + signals + stakeholders + questions)
//   PATCH  /api/account-expansion?id=X                                 — update footprint/outlook
//   DELETE /api/account-expansion?id=X                                 — permanently delete the account (confirm_company_name required)
//   POST   /api/account-expansion?id=X&action=areas                   — add an expansion area
//   PATCH  /api/account-expansion?id=X&action=areas&item_id=Y          — edit (or archive/unarchive) an expansion area
//   POST   /api/account-expansion?id=X&action=whitespace               — set (insert-or-update) a whitespace area's status
//   DELETE /api/account-expansion?id=X&action=whitespace&item_id=Y     — remove a whitespace row
//   POST   /api/account-expansion?id=X&action=signals                  — add a research signal
//   PATCH  /api/account-expansion?id=X&action=signals&item_id=Y        — edit a research signal
//   DELETE /api/account-expansion?id=X&action=signals&item_id=Y        — remove a research signal
//   POST   /api/account-expansion?id=X&action=stakeholders             — add a stakeholder
//   PATCH  /api/account-expansion?id=X&action=stakeholders&item_id=Y   — edit a stakeholder
//   DELETE /api/account-expansion?id=X&action=stakeholders&item_id=Y   — remove a stakeholder
//   POST   /api/account-expansion?id=X&action=questions                — add an open question
//   PATCH  /api/account-expansion?id=X&action=questions&item_id=Y      — edit an open question (incl. answering it)
//   DELETE /api/account-expansion?id=X&action=questions&item_id=Y      — remove an open question

import { withDbErrorHandling, ValidationError, NotFoundError } from "../../lib/account-expansion/respond.js";
import {
  listAccounts, getAccountById, createAccount, deleteAccount, getAccountDetail, updateAccountFootprint,
  createArea, updateArea,
  upsertWhitespace, deleteWhitespace,
  createSignal, updateSignal, deleteSignal,
  createStakeholder, updateStakeholder, deleteStakeholder,
  createQuestion, updateQuestion, deleteQuestion,
} from "../../lib/account-expansion/queries.js";
import { requireActor } from "../../lib/auth/actor.js";
import {
  isValidExpansionOutlook, isValidAreaStatus, isValidRelevance,
  isValidWhitespaceStatus, isValidSignalType, isValidRelationship, isValidQuestionPriority,
} from "../../lib/account-expansion/constants.js";

async function requireAccount(id) {
  const account = await getAccountById(id);
  if (!account) throw new NotFoundError("No account expansion record with that id.");
  return account;
}

// ---- top-level ----

async function handleList(req, res) {
  await withDbErrorHandling(res, () => listAccounts());
}

async function handleCreateAccount(req, res) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    const { company_name, segment_id } = req.body || {};
    if (!company_name || !String(company_name).trim()) throw new ValidationError("company_name is required.");
    const account = await createAccount({ company_name, segment_id: segment_id || null }, actor);
    return getAccountDetail(account.id);
  });
}

async function handleDeleteAccount(req, res, id) {
  await withDbErrorHandling(res, async () => {
    await requireActor(req);
    const account = await requireAccount(id);
    const confirmation = String(req.body?.confirm_company_name || "").trim();
    if (confirmation !== account.company_name) {
      throw new ValidationError("confirm_company_name must exactly match the account's company name.");
    }
    await deleteAccount(id);
    return { deleted: true, id };
  });
}

async function handleGetDetail(req, res, id) {
  await withDbErrorHandling(res, async () => {
    await requireAccount(id);
    return getAccountDetail(id);
  });
}

async function handleUpdateFootprint(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "expansion_outlook") && !isValidExpansionOutlook(req.body.expansion_outlook)) {
      throw new ValidationError("Invalid expansion_outlook.");
    }
    const account = await updateAccountFootprint(id, req.body || {}, actor);
    if (!account) throw new NotFoundError("No account expansion record with that id.");
    return { account };
  });
}

// ---- expansion areas ----

async function handleCreateArea(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    await requireAccount(id);
    const { area, status = "idea", relevance = "medium" } = req.body || {};
    if (!area || !String(area).trim()) throw new ValidationError("area is required.");
    if (!isValidAreaStatus(status)) throw new ValidationError("Invalid status.");
    if (!isValidRelevance(relevance)) throw new ValidationError("Invalid relevance.");
    const areaRow = await createArea(id, { ...req.body, status, relevance }, actor);
    return { area: areaRow };
  });
}

async function handleUpdateArea(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "status") && !isValidAreaStatus(req.body.status)) {
      throw new ValidationError("Invalid status.");
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "relevance") && !isValidRelevance(req.body.relevance)) {
      throw new ValidationError("Invalid relevance.");
    }
    const areaRow = await updateArea(id, itemId, req.body || {}, actor);
    if (!areaRow) throw new NotFoundError("No expansion area with that id for this account.");
    return { area: areaRow };
  });
}

// ---- whitespace ----

async function handleSetWhitespace(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    await requireAccount(id);
    const { area, status = "unknown" } = req.body || {};
    if (!area || !String(area).trim()) throw new ValidationError("area is required.");
    if (!isValidWhitespaceStatus(status)) throw new ValidationError("Invalid status.");
    const row = await upsertWhitespace(id, { area, status }, actor);
    return { whitespace: row };
  });
}

async function handleDeleteWhitespace(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    await requireActor(req);
    const row = await deleteWhitespace(id, itemId);
    if (!row) throw new NotFoundError("No whitespace row with that id for this account.");
    return { deleted: true, id: itemId };
  });
}

// ---- research signals ----

async function handleCreateSignal(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    await requireAccount(id);
    const { signal_date, signal_type, finding } = req.body || {};
    if (!signal_date) throw new ValidationError("signal_date is required.");
    if (!isValidSignalType(signal_type)) throw new ValidationError("Invalid signal_type.");
    if (!finding || !String(finding).trim()) throw new ValidationError("finding is required.");
    const signal = await createSignal(id, req.body, actor);
    return { signal };
  });
}

async function handleUpdateSignal(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "signal_type") && !isValidSignalType(req.body.signal_type)) {
      throw new ValidationError("Invalid signal_type.");
    }
    const signal = await updateSignal(id, itemId, req.body || {}, actor);
    if (!signal) throw new NotFoundError("No research signal with that id for this account.");
    return { signal };
  });
}

async function handleDeleteSignal(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    await requireActor(req);
    const row = await deleteSignal(id, itemId);
    if (!row) throw new NotFoundError("No research signal with that id for this account.");
    return { deleted: true, id: itemId };
  });
}

// ---- stakeholders ----

async function handleCreateStakeholder(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    await requireAccount(id);
    const { relationship = "unknown" } = req.body || {};
    if (!isValidRelationship(relationship)) throw new ValidationError("Invalid relationship.");
    const stakeholder = await createStakeholder(id, { ...req.body, relationship }, actor);
    return { stakeholder };
  });
}

async function handleUpdateStakeholder(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "relationship") && !isValidRelationship(req.body.relationship)) {
      throw new ValidationError("Invalid relationship.");
    }
    const stakeholder = await updateStakeholder(id, itemId, req.body || {}, actor);
    if (!stakeholder) throw new NotFoundError("No stakeholder with that id for this account.");
    return { stakeholder };
  });
}

async function handleDeleteStakeholder(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    await requireActor(req);
    const row = await deleteStakeholder(id, itemId);
    if (!row) throw new NotFoundError("No stakeholder with that id for this account.");
    return { deleted: true, id: itemId };
  });
}

// ---- open questions ----

async function handleCreateQuestion(req, res, id) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    await requireAccount(id);
    const { question, priority = "medium" } = req.body || {};
    if (!question || !String(question).trim()) throw new ValidationError("question is required.");
    if (!isValidQuestionPriority(priority)) throw new ValidationError("Invalid priority.");
    const questionRow = await createQuestion(id, { ...req.body, priority }, actor);
    return { question: questionRow };
  });
}

async function handleUpdateQuestion(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    const actor = await requireActor(req);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "priority") && !isValidQuestionPriority(req.body.priority)) {
      throw new ValidationError("Invalid priority.");
    }
    const questionRow = await updateQuestion(id, itemId, req.body || {}, actor);
    if (!questionRow) throw new NotFoundError("No open question with that id for this account.");
    return { question: questionRow };
  });
}

async function handleDeleteQuestion(req, res, id, itemId) {
  await withDbErrorHandling(res, async () => {
    await requireActor(req);
    const row = await deleteQuestion(id, itemId);
    if (!row) throw new NotFoundError("No open question with that id for this account.");
    return { deleted: true, id: itemId };
  });
}

export default async function handler(req, res) {
  const { id, action, item_id: itemId } = req.query;

  if (req.method === "GET") {
    if (id) return handleGetDetail(req, res, id);
    return handleList(req, res);
  }

  if (req.method === "POST") {
    if (!id) return handleCreateAccount(req, res);
    if (action === "areas") return handleCreateArea(req, res, id);
    if (action === "whitespace") return handleSetWhitespace(req, res, id);
    if (action === "signals") return handleCreateSignal(req, res, id);
    if (action === "stakeholders") return handleCreateStakeholder(req, res, id);
    if (action === "questions") return handleCreateQuestion(req, res, id);
    res.status(400).json({ error: "Missing or unrecognized ?action=." });
    return;
  }

  if (req.method === "PATCH") {
    if (!id) {
      res.status(400).json({ error: "id is required." });
      return;
    }
    if (action === "areas") return handleUpdateArea(req, res, id, itemId);
    if (action === "signals") return handleUpdateSignal(req, res, id, itemId);
    if (action === "stakeholders") return handleUpdateStakeholder(req, res, id, itemId);
    if (action === "questions") return handleUpdateQuestion(req, res, id, itemId);
    if (!action) return handleUpdateFootprint(req, res, id);
    res.status(400).json({ error: "Unrecognized ?action=." });
    return;
  }

  if (req.method === "DELETE") {
    if (!id) {
      res.status(400).json({ error: "id is required." });
      return;
    }
    if (!action) return handleDeleteAccount(req, res, id);
    if (!itemId) {
      res.status(400).json({ error: "item_id is required." });
      return;
    }
    if (action === "whitespace") return handleDeleteWhitespace(req, res, id, itemId);
    if (action === "signals") return handleDeleteSignal(req, res, id, itemId);
    if (action === "stakeholders") return handleDeleteStakeholder(req, res, id, itemId);
    if (action === "questions") return handleDeleteQuestion(req, res, id, itemId);
    res.status(400).json({ error: "Missing or unrecognized ?action=." });
    return;
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  res.status(405).json({ error: `Method ${req.method} not allowed.` });
}
