-- Makes a lead's call numbering unique, backstopping the race that addCall()
-- used to lose.
--
-- addCall() computed `call_number` with a `select count(*)` in a separate
-- HTTP round trip from the insert, so two concurrent "log a call" clicks on
-- the same lead both read the same count and both wrote the same number.
-- lib/demo-calls/queries.js now derives the number inside the INSERT itself;
-- this index is what guarantees it, turning any remaining collision into a
-- 23505 (surfaced as a 409) instead of a silent duplicate.
--
-- Duplicates matter beyond tidiness: listLeads() reads outcomes positionally
-- via (array_agg(outcome order by call_number asc))[1..3], so two rows
-- sharing call_number 2 push the real third call out of the window and make
-- the first/second/third-call KPIs disagree with the call log on screen.

-- Any duplicates the old code already created have to go before a unique
-- index can exist. Renumber every lead's calls densely from 1, preserving
-- the existing order and breaking ties by creation time then id so the
-- result is deterministic. Leads with no duplicates keep the numbers they
-- have (row_number over an already-dense 1..n sequence returns 1..n).
with renumbered as (
  select
    id,
    row_number() over (partition by lead_id order by call_number, created_at, id) as new_number
  from demo_call_logs
)
update demo_call_logs c
set call_number = r.new_number
from renumbered r
where c.id = r.id and c.call_number <> r.new_number;

create unique index if not exists demo_call_logs_lead_id_call_number_uq
  on demo_call_logs (lead_id, call_number);

-- The old non-unique index on the same columns is now redundant: the unique
-- index serves every lookup it served, and carrying both doubles the write
-- cost on a table that is append-heavy.
drop index if exists demo_call_logs_lead_id_idx;
