-- Suppliers: add, edit and control the visibility of each supplier's products.
-- Run once in the Supabase SQL editor (safe to re-run). Run before the storefront
-- code that reads suppliers is relied on, and before scripts/tlc-import.mjs.
--
-- Every product points at a supplier (products.supplier_id). The supplier is an
-- INTERNAL fact: it is never shown to customers (Trends' API terms forbid naming
-- them). The one exception is a supplier whose listing_status is 'sample', where
-- public_label (e.g. "TLC sample") is shown as a badge while we wait for approval.
--
--   listing_status  active     live, no badge
--                   sample     live with the public_label badge, pending the supplier's OK
--                   withdrawn  all of the supplier's products are hidden
--   active = false also hides every product from that supplier.

alter table public.suppliers
  add column if not exists slug text,
  add column if not exists website text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists listing_status text not null default 'active',
  add column if not exists public_label text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.suppliers drop constraint if exists suppliers_listing_status_check;
alter table public.suppliers
  add constraint suppliers_listing_status_check
  check (listing_status in ('active', 'sample', 'withdrawn'));

update public.suppliers
set slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
where slug is null;

create unique index if not exists suppliers_slug_key on public.suppliers (slug);

insert into public.suppliers (name, slug, channel, website, notes)
values ('Trends', 'trends', 'api', 'https://www.trends.co.nz', 'Catalogue and pricing via the Trends API. Never named on the storefront (API terms).')
on conflict (slug) do nothing;

insert into public.suppliers (name, slug, channel, website, notes, listing_status, public_label)
values (
  'TLC Live', 'tlc', 'email_po', 'https://www.tlc-live.co.nz',
  'Banners and stretch fabric displays from the September 2024 product guide. Shown as a sample until TLC agrees to usage and hosting; then set to Live. If they decline, set to Withdrawn or run scripts/tlc-import.mjs --remove.',
  'sample', 'TLC sample'
)
on conflict (slug) do nothing;

-- Products point at their supplier. products.supplier (text) stays for the importers.
alter table public.products
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists products_supplier_id_idx on public.products (supplier_id);

update public.products p
set supplier_id = s.id
from public.suppliers s
where p.supplier_id is null and p.supplier = s.slug;

-- Handy checks:
--   select s.name, s.listing_status, count(p.id) from suppliers s
--   left join products p on p.supplier_id = s.id group by 1, 2;
--   Products with no supplier recorded (hand-made pilot products):
--   select slug from products where supplier_id is null;
