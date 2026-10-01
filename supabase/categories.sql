-- Storefront categories. Run once in the Supabase SQL editor (safe to re-run).
-- Our own two-level tree, modelled on imprintnow.co.nz/product/tradeshow-and-events,
-- deliberately separate from any supplier's category numbers. A product can sit in
-- several categories. A category with no active products shows "Coming soon" on the
-- storefront and switches to a product grid by itself once one is assigned.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_id uuid references public.categories(id) on delete cascade,
  sort_order integer not null default 0,
  image_url text, -- optional; the storefront falls back to the first product's image
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_idx
  on public.product_categories (category_id);

-- Top level group.
insert into public.categories (slug, name, sort_order)
values ('trade-show-and-events', 'Trade Show & Events', 10)
on conflict (slug) do nothing;

-- ImprintNow's 17 tradeshow tiles, in their order.
insert into public.categories (slug, name, parent_id, sort_order)
select v.slug, v.name, p.id, v.sort_order
from (values
  ('table-covers', 'Table Covers', 10),
  ('lanyards', 'Lanyards', 20),
  ('banners-and-displays', 'Banners & Displays', 30),
  ('banner-stands', 'Banner Stands', 40),
  ('buttons', 'Buttons', 50),
  ('flags', 'Flags', 60),
  ('id-cards', 'ID Cards', 70),
  ('pens', 'Pens', 80),
  ('tote-bags', 'Tote Bags', 90),
  ('trade-show-displays', 'Trade Show Displays', 100),
  ('awards', 'Awards', 110),
  ('tickets', 'Tickets', 120),
  ('cards', 'Cards', 130),
  ('event-and-promotion-inflatables', 'Event & Promotion Inflatables', 140),
  ('tents', 'Tents', 150),
  ('inflatable-tents', 'Inflatable Tents', 160),
  ('auction-paddles', 'Auction Paddles', 170)
) as v(slug, name, sort_order)
cross join public.categories p
where p.slug = 'trade-show-and-events'
on conflict (slug) do nothing;

-- The 7 pilot products, placed by hand (no supplier category to map from).
insert into public.product_categories (product_id, category_id)
select p.id, c.id
from (values
  ('table-covers', 'table-covers'),
  ('lanyards', 'lanyards'),
  ('custom-buttons', 'buttons'),
  ('banner-stands', 'banner-stands'),
  ('led-lightbox-bannerstand', 'banner-stands'),
  ('led-lightbox-counter', 'trade-show-displays'),
  ('feather-teardrop-flags', 'flags')
) as v(product_slug, category_slug)
join public.products p on p.slug = v.product_slug
join public.categories c on c.slug = v.category_slug
on conflict do nothing;

-- Manual assignment, e.g. a banner stand added by hand:
--   insert into public.product_categories (product_id, category_id)
--   select p.id, c.id from public.products p, public.categories c
--   where p.slug = 'roll-up-banner-stand' and c.slug = 'banner-stands'
--   on conflict do nothing;
