// Transactional email — currently just the "you were tagged on a lead"
// notification triggered from api/pipeline/[id]/notes.js. Plain `fetch`
// against Resend's HTTP API, no SDK dependency, mirroring lib/hubspot.js's
// style. Callers must treat send failures as best-effort (see notes.js) —
// a broken/missing RESEND_API_KEY should never block a note from saving.

const RESEND_URL = "https://api.resend.com/emails";
const SANDBOX_FROM = "Sales Pipeline <onboarding@resend.dev>"; // works before heizen.work is DNS-verified, but only delivers to the Resend account's own address

export class EmailConfigError extends Error {}

function getResendKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new EmailConfigError("RESEND_API_KEY environment variable is not set on this deployment.");
  }
  return key;
}

async function sendEmail({ to, subject, html, text }) {
  const key = getResendKey();
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || SANDBOX_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend request failed (${res.status}): ${body.message || JSON.stringify(body)}`);
  }
}

function leadUrl(req, leadId) {
  if (!req?.headers?.host) return null;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}/pipeline?lead=${leadId}`;
}

const BRAND = "#2a78d6"; // matches --seq-450 in src/styles/tokens.css, the app's accent color

// Mirrors the labels/colors in src/modules/pipeline/constants.js (STAGES,
// PRIORITY_OPTIONS) — duplicated by hand here rather than imported, same as
// lib/pipeline/constants.js already mirrors the frontend's copy, since this
// is a plain-Node function rendering HTML, not a UI component.
const STAGE_META = {
  sql: { label: "SQL", color: "#6b7280" },
  discovery: { label: "Discovery", color: "#2a78d6" },
  proposal: { label: "Proposal", color: "#2a78d6" },
  commercial: { label: "Commercial", color: "#1e5aa8" },
  won: { label: "Won", color: "#16a34a" },
  cold: { label: "Cold", color: "#6b7280" },
  lost: { label: "Lost", color: "#dc2626" },
};
const PRIORITY_META = {
  high: { label: "P0 · High", color: "#dc2626" },
  medium: { label: "P1 · Medium", color: "#2a78d6" },
  low: { label: "P2 · Low", color: "#6b7280" },
};
const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// Mention tokens (e.g. "@Aryan", "@newperson@co.com") only exist to address
// the note, not as part of the task itself — stripped so the "what's
// needed" section in the email reads like a clean instruction, not chat
// text. The in-app timeline still shows the raw text with tokens intact.
export function stripMentions(noteBody) {
  return noteBody.replace(/@\S+\s*/g, "").trim() || noteBody.trim();
}

function badge(label, color) {
  return `<span style="display:inline-block;background:${color}1a;color:${color};font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:20px;">${escapeHtml(label)}</span>`;
}

/** Sends the "you were tagged" notification for one recipient. Throws on failure — callers decide how to handle that (see notes.js, which swallows it per-recipient). */
export async function notifyTagged({ to, actor, companyName, contactName, stage, priority, dealSize, leadId, noteBody, req }) {
  const url = leadUrl(req, leadId);
  const task = stripMentions(noteBody);
  const stageMeta = STAGE_META[stage] || { label: stage || "—", color: "#6b7280" };
  const priorityMeta = PRIORITY_META[priority] || null;

  const subject = `${actor} tagged you on ${companyName} (${stageMeta.label})`;
  const text = [
    `${actor} tagged you on ${companyName} — stage: ${stageMeta.label}${priorityMeta ? `, priority: ${priorityMeta.label}` : ""}.`,
    "",
    `What's needed: ${task}`,
    "",
    url ? `View the lead: ${url}` : null,
  ].filter(Boolean).join("\n");

  // Inline-styled, table-based layout — the safe subset that renders
  // consistently across Gmail/Outlook/etc, since email clients don't load
  // external stylesheets. Kept to one function; no templating library.
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND},#1e5aa8);padding:26px 28px 20px;">
            <div style="font-size:26px;line-height:1;margin-bottom:8px;"></div>
            <div style="color:#ffffff;font-size:19px;font-weight:700;">You've been tagged!</div>
            <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px;">by ${escapeHtml(actor)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px 6px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8a93a3;margin-bottom:4px;">Project</div>
            <div style="font-size:17px;font-weight:700;color:#1a1d24;">${escapeHtml(companyName)}</div>
            ${contactName ? `<div style="font-size:12.5px;color:#8a93a3;margin-top:2px;">${escapeHtml(contactName)}</div>` : ""}
            <div style="margin-top:12px;">
              ${badge(stageMeta.label, stageMeta.color)}
              ${priorityMeta ? ` ${badge(priorityMeta.label, priorityMeta.color)}` : ""}
              ${dealSize != null ? ` ${badge(currency.format(dealSize), "#6b7280")}` : ""}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 24px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#8a93a3;margin-bottom:8px;">What's needed</div>
            <div style="background:#f7f9fc;border:1px solid #e7ebf1;border-radius:10px;padding:14px 16px;font-size:14.5px;line-height:1.5;color:#1a1d24;white-space:pre-wrap;">${escapeHtml(task)}</div>
            ${url ? `
            <div style="margin-top:22px;">
              <a href="${url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;">View the lead →</a>
            </div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#fafbfc;border-top:1px solid #eef1f5;">
            <div style="font-size:11.5px;color:#9aa3b2;">Sent from the Sales Pipeline dashboard — reply directly to ${escapeHtml(actor)} if you have questions.</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
  `;
  await sendEmail({ to, subject, html, text });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
