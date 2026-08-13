-- Adds "scheduled" as a valid demo_call_logs.outcome — a call logged with a
-- future call_date hasn't happened yet, so it can't be Completed or No Show
-- (see isFutureCallDate()/outcomeOptionsFor() in
-- src/modules/demo-calls/constants.js, which is what actually enforces this
-- at input time — this constraint is just the DB-level backstop).
-- drop-then-add makes this idempotent (same end state on every run) since
-- Postgres has no "add value to check constraint" / "alter constraint" form —
-- the constraint has to be replaced wholesale.
alter table demo_call_logs drop constraint if exists demo_call_logs_outcome_check;
alter table demo_call_logs add constraint demo_call_logs_outcome_check
  check (outcome in ('completed', 'no_show', 'scheduled'));
