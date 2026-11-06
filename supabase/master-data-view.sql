-- One row per product for the team's Master data page (6 Nov 2026). Run once in the
-- Supabase SQL editor. Safe to run before or after deploying the matching code: the page
-- falls back to reading the separate tables (slower) until this has been run.
--
-- Why: the page used to read products, category links, price breaks, supplier pricing and
-- overrides as five separate lists (about 40 database reads, each a round trip from the web
-- servers). This view joins them inside the database, so the page needs about three reads.
--
-- Staff only. The view carries supplier cost, so the website's public key cannot read it:
-- access is revoked from anon and authenticated, and only the server (service role) can.
begin;

create or replace view public.master_data_rows
with (security_invoker = on) as
select
  p.id,
  p.slug,
  p.name,
  p.short_description,
  p.supplier,
  p.active,
  p.unit_price,
  p.min_order_qty,
  p.example_image_urls[1] as first_image,
  coalesce(cardinality(p.example_image_urls), 0) as image_count,
  p.supplier_id,
  p.supplier_updated_at,
  p.product_details -> 'specifications' as specs,
  s.name as supplier_name,
  s.slug as supplier_slug,
  s.listing_status as supplier_listing_status,
  s.active as supplier_active,
  coalesce(
    (select array_agg(c.slug)
       from public.product_categories pc
       join public.categories c on c.id = pc.category_id
      where pc.product_id = p.id),
    '{}'::text[]
  ) as category_slugs,
  sp.price_type,
  b.min_qty as first_break_qty,
  b.unit_cost as first_break_cost,
  coalesce(
    (select jsonb_agg(jsonb_build_object(
              'field', o.field,
              'supplier_value', o.supplier_value,
              'edited_by', o.edited_by,
              'edited_at', o.edited_at,
              'needs_review', o.needs_review,
              'review_note', o.review_note))
       from public.product_overrides o
      where o.product_id = p.id),
    '[]'::jsonb
  ) as overrides
from public.products p
left join public.suppliers s on s.id = p.supplier_id
left join lateral (
  select price_type
    from public.product_supplier_pricing
   where product_id = p.id
   limit 1
) sp on true
left join lateral (
  select min_qty, unit_cost
    from public.product_price_breaks
   where product_id = p.id
   order by min_qty asc
   limit 1
) b on true;

revoke all on public.master_data_rows from anon, authenticated;
grant select on public.master_data_rows to service_role;

commit;
