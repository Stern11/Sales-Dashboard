-- Adds tagged_emails to notes for the @-mention tagging feature (tagging
-- someone triggers an email — see lib/email.js). Not FK'd to any user table
-- — this app has no user directory, just a hand-edited autocomplete list
-- (src/modules/pipeline/team.js) that isn't a hard cap, so any email string
-- is valid here. Added 2026-08-06.
alter table pipeline_lead_notes add column if not exists tagged_emails text[] not null default '{}';
