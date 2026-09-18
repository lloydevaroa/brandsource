-- Managed-client notification milestones (build-brief.md item 4).
-- Adds the fields notifications need: somewhere to email a managed client,
-- and a one-off flag for the one milestone ("manufacturing finished") that
-- doesn't correspond to an order_status transition on its own.
begin;

alter table public.clients
  add column contact_email text;

alter table public.orders
  add column manufacturing_finished_notified_at timestamptz;

commit;
