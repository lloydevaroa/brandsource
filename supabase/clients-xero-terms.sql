-- Payment terms live in Xero, not here (decided 5 Oct 2026). Account
-- managers are optional: any staff member can raise an order for any client.
-- Run once in the Supabase SQL editor, after xero.sql. Run it BEFORE deploying
-- the matching code, and before scripts/import-clients.mjs.
begin;

alter table public.clients
  drop constraint clients_managed_requires_manager_and_terms;

-- Dropping the column also drops its 7/14/30 check. Any terms entered so far
-- are discarded; the Xero contact's own terms apply to invoices instead.
alter table public.clients
  drop column credit_term_days;

-- Client names must match the Xero contact name exactly, so a name is unique.
create unique index clients_name_key on public.clients (lower(name));

commit;
