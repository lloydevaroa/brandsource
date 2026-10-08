-- Rate card tiers (8 Oct 2026). A tier is a percentage discount off the RRP
-- (products.unit_price). Retail (tier 5, 0%) is what everyone pays by default.
-- A tier only applies when staff pick it on a PO order, or when a signed-in
-- customer's linked client (profiles.client_id) has one. Run once in the
-- Supabase SQL editor, BEFORE deploying the matching code.
begin;

create table public.rate_tiers (
  id uuid primary key default gen_random_uuid(),
  level integer not null unique check (level between 1 and 5),
  name text not null,
  discount_percent numeric(5,2) not null check (discount_percent >= 0 and discount_percent < 100),
  updated_at timestamptz not null default now()
);
alter table public.rate_tiers enable row level security;

insert into public.rate_tiers (level, name, discount_percent) values
  (5, 'Retail', 0),
  (4, 'Bronze', 5),
  (3, 'Silver', 10),
  (2, 'Gold', 15),
  (1, 'Platinum', 20);

-- Null = Retail. Set per client; customers inherit it through profiles.client_id.
alter table public.clients add column rate_tier_id uuid references public.rate_tiers(id);

-- What was charged: the order records its tier, each line records the RRP it
-- was discounted from (unit_price stays the amount actually charged/invoiced).
alter table public.orders add column rate_tier_id uuid references public.rate_tiers(id);
alter table public.order_lines add column list_price numeric(12,2);

commit;
