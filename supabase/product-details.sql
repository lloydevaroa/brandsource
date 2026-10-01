-- Rich product detail (features, specs, materials, dimensions, branding areas,
-- packaging, template PDF). Run once in the Supabase SQL editor, then re-run
-- scripts/trends-import.mjs to fill it for imported products.
alter table public.products
  add column if not exists product_details jsonb;
