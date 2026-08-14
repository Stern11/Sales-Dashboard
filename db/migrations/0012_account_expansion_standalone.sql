-- Account Expansion becomes its own top-level module, decoupled from ABM
-- Outreach (src/modules/account-expansion/, moved out of
-- src/modules/abm/expansion/). Accounts tracked here are Heizen's existing
-- clients (expansion/upsell targets), not ABM prospects, so they're no
-- longer sourced from an ABM segment's HubSpot company list — a rep creates
-- an account directly in this module instead. hubspot_company_id accordingly
-- stops being a required key. The existing unique index on it is untouched
-- (a unique index already allows any number of NULLs).

alter table account_expansion alter column hubspot_company_id drop not null;
