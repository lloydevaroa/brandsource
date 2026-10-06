-- Supplier cost pricing (Trends). Run once in the Supabase SQL editor, after
-- supplier-import.sql, before scripts/trends-pricing-import.mjs.
--
-- These are BrandSource's COST prices from the supplier, ex-GST. They are never
-- shown to customers and do not touch products.unit_price (the flat sell price,
-- Joe's call). Row level security is on with no policies, so only the service
-- role (server code and the import script) can read them, not the public anon key.
-- Kept in their own tables, not on products, so a cost can't leak through a
-- products query.
begin;

-- One row per product: how the supplier prices it overall.
create table if not exists public.product_supplier_pricing (
  product_id uuid primary key references public.products(id) on delete cascade,
  price_type text not null,                   -- Trends' "type": Stock, or Indent - Air (made to order)
  price_basis text not null default '',       -- what the break price includes, e.g. "Including full colour print"
  orderable_below_moq boolean not null default false, -- Trends' less_than_moq flag
  pricing_comment text not null default '',
  supplier_updated_at timestamptz,
  imported_at timestamptz not null default now()
);

-- Quantity breaks: "from this many, each costs this much".
create table if not exists public.product_price_breaks (
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty integer not null,
  unit_cost numeric(12,4) not null,
  primary key (product_id, min_qty)
);

-- Charges on top of the break price. kind is Trends' own code (our reading):
--   DO = decoration option for the first print position (per-unit charge + one-off setup)
--   DS = decoration surcharge / extra position (second side, personalisation line)
--   OE = optional extra sold with the product (base, stake, mount)
create table if not exists public.product_extra_costs (
  product_id uuid not null references public.products(id) on delete cascade,
  supplier_charge_id integer not null,
  kind text not null check (kind in ('DO', 'DS', 'OE')),
  branding_option text not null default '',
  branding_area text not null default '',
  description text not null default '',
  unit_cost numeric(12,4) not null default 0, -- added per unit
  setup_cost numeric(12,2) not null default 0, -- one-off per order
  primary key (product_id, supplier_charge_id)
);

alter table public.product_supplier_pricing enable row level security;
alter table public.product_price_breaks enable row level security;
alter table public.product_extra_costs enable row level security;

commit;
