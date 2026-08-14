-- Indexes matching how the two list endpoints actually sort.
--
-- listLeads() in lib/demo-calls/queries.js orders by `created_at desc`, but
-- the only date index on demo_call_leads was on `updated_at desc` — a
-- different column, so the sort could not use it. listAccounts() in
-- lib/account-expansion/queries.js orders by `updated_at desc` and
-- account_expansion had no index on it at all.
--
-- Honest scope note: both tables hold hundreds of rows today, where Postgres
-- will happily sort in memory and these change little. They're added because
-- the sort is unbounded (neither endpoint paginates) and the cost of being
-- wrong grows with the table, not because either is slow right now.

create index if not exists demo_call_leads_created_at_idx
  on demo_call_leads (created_at desc);

create index if not exists account_expansion_updated_at_idx
  on account_expansion (updated_at desc);

-- Deliberately NOT dropped, though no server query filters on them today
-- (all stage/status filtering happens client-side):
--   pipeline_leads_stage_idx (stage)
--   demo_call_leads_status_idx (status)
-- At these table sizes their write cost is negligible, and they are exactly
-- what server-side stage/status filtering would need if the list endpoints
-- ever paginate. Removing them would be churn with a theoretical payoff.
