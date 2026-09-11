-- BRANDSource V1 schema
-- Xero deferred; invoices kept simple and Xero-ready later.
-- Clerk owns auth; profiles map clerk_user_id → role.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer', 'admin', 'manager');
create type public.supplier_channel as enum ('api', 'email_po', 'manual_portal');
create type public.selection_mode as enum ('single', 'multi');
create type public.sub_order_status as enum (
  'new_order',
  'payment_received',
  'artwork_required',
  'proof_awaiting_approval',
  'ready_to_order',
  'sent_to_supplier',
  'in_production',
  'dispatched',
  'completed'
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  full_name text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel public.supplier_channel not null default 'manual_portal',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text not null default '',
  unit_price numeric(12,2), -- null until PO quotes land
  currency text not null default 'NZD',
  min_order_qty integer not null default 1,
  example_image_urls text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  key text not null,
  label text not null,
  selection public.selection_mode not null default 'single',
  required boolean not null default true,
  sort_order integer not null default 0,
  unique (product_id, key)
);

create table public.option_choices (
  id uuid primary key default gen_random_uuid(),
  option_group_id uuid not null references public.option_groups(id) on delete cascade,
  key text not null,
  label text not null,
  price_delta numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  unique (option_group_id, key)
);

-- Order shell + independent sub-orders (split fulfilment)
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id),
  stripe_payment_intent_id text,
  total_amount numeric(12,2),
  currency text not null default 'NZD',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sub_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_line_id uuid references public.order_lines(id) on delete set null,
  supplier_id uuid references public.suppliers(id),
  status public.sub_order_status not null default 'new_order',
  eta_days integer,
  tracking text,
  staff_notes text,
  claimed_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.artwork_files (
  id uuid primary key default gen_random_uuid(),
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  storage_path text not null,
  status text not null default 'awaiting_approval', -- awaiting_approval | approved | changes_requested
  customer_note text,
  created_at timestamptz not null default now()
);

-- Simple invoices (Xero deferred — keep fields Xero-compatible later)
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  number text not null unique,
  amount numeric(12,2) not null,
  currency text not null default 'NZD',
  status text not null default 'draft', -- draft | sent | paid | void
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create index sub_orders_status_idx on public.sub_orders(status);
create index products_slug_idx on public.products(slug);
create index order_lines_order_idx on public.order_lines(order_id);
