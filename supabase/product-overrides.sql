-- Product edits from the Master data page (22 Oct 2026). Run once in the Supabase
-- SQL editor. Safe to run before or after deploying the matching code: the page
-- carries on read-only (with a notice) until this has been run.
--
-- products.short_description, products.unit_price and product_categories always
-- hold the LIVE value customers see. When staff edit one of those fields on a
-- supplier (Trends) product, product_overrides keeps what the supplier sent, so
-- the page can show "supplier says / website says", revert to the supplier value,
-- and the importers know to leave the field alone. If the supplier later sends
-- something different, the importer updates supplier_value and sets needs_review,
-- which shows in the table and is emailed to the admins.
--
-- product_change_log is the permanent record of who changed what and when.
begin;

create table public.product_overrides (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  field text not null check (field in ('description', 'rrp', 'categories')),
  -- What the supplier supplies for this field: text, a number, or an array of
  -- category slugs. Null for products with no supplier-side value.
  supplier_value jsonb,
  edited_by uuid references public.profiles(id) on delete set null,
  edited_at timestamptz not null default now(),
  needs_review boolean not null default false,
  review_note text,
  unique (product_id, field)
);
create index product_overrides_review_idx on public.product_overrides (needs_review) where needs_review;
alter table public.product_overrides enable row level security;

create table public.product_change_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  field text not null check (field in ('description', 'rrp', 'categories')),
  -- edit: staff changed it on screen. revert: staff went back to the supplier
  -- value. keep: staff kept their edit after a supplier change.
  -- supplier_change: an import found the supplier now sends a different value.
  kind text not null check (kind in ('edit', 'revert', 'keep', 'supplier_change')),
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  changed_at timestamptz not null default now()
);
create index product_change_log_product_idx on public.product_change_log (product_id, changed_at desc);
alter table public.product_change_log enable row level security;

commit;
