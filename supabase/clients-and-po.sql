-- Managed-client PO data model (build-brief.md immediate-priority item 1).
-- Adds the client/account-manager/credit-terms model and formalizes order-level
-- lifecycle status, ahead of the managed-client PO flow (item 2) and Xero push
-- (item 5). Run once in the Supabase SQL editor, after schema.sql/seed.sql.
begin;

create type public.client_type as enum ('managed', 'direct');

-- credit_term_days matches the three terms confirmed in build-brief.md
-- ("Managed client credit terms & Xero split").
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_type public.client_type not null default 'direct',
  account_manager_id uuid references public.profiles(id),
  credit_term_days integer check (credit_term_days in (7, 14, 30)),
  created_at timestamptz not null default now(),
  constraint clients_managed_requires_manager_and_terms check (
    client_type = 'direct'
    or (account_manager_id is not null and credit_term_days is not null)
  )
);

create index clients_account_manager_idx on public.clients(account_manager_id);

-- Links a signed-in contact to the organisation they order on behalf of.
-- Null for direct consumers and for staff-only profiles.
alter table public.profiles
  add column client_id uuid references public.clients(id);

-- Order-level lifecycle, distinct from the per-sub-order status in
-- sub_order_status. Coarser on purpose: this is what the admin status
-- overview and CSV reporting (item 3/6) roll up to, not a duplicate of the
-- Kanban board.
create type public.order_status as enum (
  'draft',
  'new_order',
  'in_production',
  'completed',
  'invoiced'
);

create type public.order_payment_method as enum ('card', 'po');

alter table public.orders
  add column client_id uuid references public.clients(id),
  add column payment_method public.order_payment_method not null default 'card',
  add column po_number text,
  add column created_by_id uuid references public.profiles(id),
  add column status_new public.order_status not null default 'draft',
  add constraint orders_po_requires_client check (
    payment_method = 'card' or client_id is not null
  );

-- Backfill from the existing free-text status column, then swap it in.
update public.orders set status_new = 'new_order' where status = 'paid';
update public.orders set status_new = 'draft' where status = 'draft';

alter table public.orders drop column status;
alter table public.orders rename column status_new to status;

create index orders_client_idx on public.orders(client_id);
create index orders_status_idx on public.orders(status);

commit;
