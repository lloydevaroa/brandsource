-- Supplier pricing research — reference data only, not live product pricing.
-- BrandSource's own products.unit_price stays null until Joe sets flat prices;
-- this table just captures what a given supplier charges, as a sanity check.
-- Run once in the Supabase SQL editor after schema.sql/seed.sql.
begin;

create table public.supplier_pricing_research (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  product_slug text references public.products(slug),
  category_label text not null, -- BrandSource category, in case no product match
  matched_item_name text, -- the supplier's product name, null if no match found
  source_url text,
  qty_1_cost numeric(12,2), -- landed unit cost incl. setup/print charge, ex-shipping, ex-GST
  qty_5_cost numeric(12,2),
  qty_10_cost numeric(12,2),
  -- Trends' own quote-tool suggested retail (65%/60%/55% markup on cost at qty 1/5/10).
  -- A sanity-check reference only, not a number to copy directly — Trends sells on a
  -- tiered-quantity model, BrandSource is positioned on flat pricing. Project owner's call.
  trends_suggested_retail_qty1 numeric(12,2),
  trends_suggested_retail_qty5 numeric(12,2),
  trends_suggested_retail_qty10 numeric(12,2),
  notes text,
  checked_at timestamptz not null default now()
);

insert into public.suppliers (name, channel, notes)
values (
  'Trends',
  'manual_portal',
  'trends.nz — NZ promo/merch distributor. Trade pricing is login-gated (no public API pricing, no self-serve pricing without an account). Account: joe@brandspanking.co.nz (shows as "Brandspanking / Phenomenon" once logged in). No dedicated Signage/Banners category — display items sit under Print > Signage.'
);

insert into public.supplier_pricing_research
  (supplier_id, product_slug, category_label, matched_item_name, source_url,
   qty_1_cost, qty_5_cost, qty_10_cost,
   trends_suggested_retail_qty1, trends_suggested_retail_qty5, trends_suggested_retail_qty10,
   notes)
values
  (
    (select id from public.suppliers where name = 'Trends'),
    'table-covers', 'Table covers', 'Large Stretched Tablecloth (fitted, full-surface sublimation)',
    'https://trends.nz/product/large-stretched-tablecloth',
    451.06, 391.52, 322.15,
    769.00, 650.43, 597.53,
    'Trends only offers a stretched/fitted style in 3 fixed sizes (Large/Medium/Small), not BrandSource''s throw/fitted/stretch x 6ft/8ft matrix. Medium as low as $320.19, Small as low as $252.15 (qty 10, before setup+shipping). Suggested-retail columns are Trends'' own quote-tool output at 65%/60%/55% markup — a sanity-check reference, not a number to copy, since BrandSource is flat-priced rather than tiered by quantity.'
  ),
  (
    (select id from public.suppliers where name = 'Trends'),
    'feather-teardrop-flags', 'Feather & teardrop flags', 'Large Feather Flag Kit (single-side sublimated, pole + bag; base sold separately)',
    'https://trends.nz/product/large-feather-flag-kit',
    271.59, 219.51, 205.92,
    448.12, 351.22, 319.18,
    'Teardrop Flag Kit is priced identically at every size (Large/Med/Small: $200.42 / $156.32 / $119.78 as low as, qty 10). Bases are separate line items: Ground Stake $25, 5kg Cross Base $80, 10kg Base Plate $100, 20kg Base Plate $140, 30kg Stackable Water $150, Vertical/Angled Wall Mount $65, Towbar/U-base $70 — matches our base option group directly. Double-sided print adds $90/order (single side is included in the $40 setup).'
  ),
  (
    (select id from public.suppliers where name = 'Trends'),
    'banner-stands', 'Banner stands', 'Pull-Up Banner Stand (roll-up, single-sided, aluminium base)',
    'https://trends.nz/product/pull-up-banner-stand',
    465.50, 405.96, 384.92,
    768.08, 649.54, 596.63,
    'Pull-Up Banner Stand Wide as low as $448.81 (qty 10). No plain X-stand found — Trends only carries roll-up style. Portable Event Lightbox Bannerstand also available as a premium option, as low as $701.42.'
  ),
  (
    (select id from public.suppliers where name = 'Trends'),
    'lanyards', 'Lanyards', '3D Logo Lanyard (raised 3D branding, closest match to full-colour sublimation)',
    'https://trends.nz/search?term=lanyard',
    null, null, 1.29,
    null, null, null,
    'Wide range at this qty10 price point: Colour Max Lanyard 16mm $1.09, Soft Touch Logo $1.79, Woven $1.14, Jacquard $1.10 — all as low as, qty 10. True sublimation full-colour equivalent likely sits near the top of this range ($1.30-$1.80). Did not open the Pricing/Quote Calculator tab for this one.'
  ),
  (
    (select id from public.suppliers where name = 'Trends'),
    'custom-buttons', 'Custom buttons', 'Button Badge Round — priced per size, pin back',
    'https://trends.nz/search?term=button%20badge',
    null, null, 1.00,
    null, null, null,
    '37mm $0.65, 58mm $0.79, 75mm $1.00, 90mm $1.22, Oval 65x45mm $0.87 (all as low as, qty 10 — our 50mm size sits between the 37mm and 58mm price points). No magnet-back variant found; Trends'' badges appear pin-back only. Did not open the Pricing/Quote Calculator tab for this one.'
  ),
  (
    (select id from public.suppliers where name = 'Trends'),
    'led-lightbox-bannerstand', 'LED lightbox bannerstand', 'Portable Event Lightbox Bannerstand (backlit LED, single or double-sided, tool-free interlocking frame)',
    'https://trends.nz/product/portable-event-lightbox-bannerstand',
    null, null, 701.42,
    null, null, null,
    'Replaces the original ''vinyl-banners'' catalogue slot (2026-09-15) — Trends does not stock flat hanging PVC/vinyl banners at all (checked: only banner stands, flags and tablecloths under Signage). This backlit lightbox stand is a real, well-matched Trends product instead. $701.42 is the qty-10 base print price only (Details/Pricing tab kept timing out in-browser before setup+shipping and the Quote Calculator markup figures could be captured — re-check on trends.nz if exact landed cost is needed). W850 x H2000mm, one fixed size.'
  ),
  (
    (select id from public.suppliers where name = 'Trends'),
    'led-lightbox-counter', 'LED lightbox counter', 'Portable Event Lightbox Counter (backlit LED, ABS countertop, single-sided only)',
    'https://trends.nz/product/portable-event-lightbox-counter',
    null, null, 825.62,
    null, null, null,
    'Replaces the original ''popup-banners'' catalogue slot (2026-09-15) — no pack-and-go backdrop-wall product exists in Trends'' catalogue (pull-up banner stands, already covered under banner-stands, were the closest match and not distinct enough). This backlit counter/podium is a real, well-matched Trends product instead. $825.62 is the qty-10 base print price only (same caveat as the lightbox bannerstand — setup/shipping/markup figures not captured). W1100 x H1000 x D320mm, one fixed size, single-sided only (no double-sided option offered for this item).'
  );

commit;
