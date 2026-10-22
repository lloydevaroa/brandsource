-- Lets a storefront category remember which Trends category it mirrors, so the backfill can
-- place each product by Trends' own category number. Run once in the Supabase SQL editor
-- (safe to re-run), before scripts/trends-categories-sync.mjs. Internal only: the number
-- is never shown to customers.

alter table public.categories
  add column if not exists trends_num text; -- e.g. "1-0" (parent) or "1-1" (subcategory)

create unique index if not exists categories_trends_num_key
  on public.categories (trends_num)
  where trends_num is not null;
