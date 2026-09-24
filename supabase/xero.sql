-- Xero push (build-brief.md immediate-priority item 5).
-- Stores the one Xero organisation connection BrandSource invoices from, and
-- links clients/orders to the Xero records created for them. Xero stays the
-- system of record for invoices; these columns only remember what was pushed.
-- Run once in the Supabase SQL editor, after clients-and-po.sql.
begin;

-- Single-row table: BrandSource connects exactly one Xero organisation.
-- Tokens are only ever read/written server-side with the service-role key;
-- RLS on with no policies keeps them unreachable from the anon key.
create table public.xero_connection (
  id integer primary key default 1 check (id = 1),
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_by_id uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.xero_connection enable row level security;

-- Matched to an existing Xero contact by name on first invoice, or created.
alter table public.clients
  add column xero_contact_id text;

alter table public.orders
  add column xero_invoice_id text,
  add column xero_invoice_number text,
  add column invoiced_at timestamptz;

commit;
