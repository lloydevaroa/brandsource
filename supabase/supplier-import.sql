-- Supplier import tracking. Run once in the Supabase SQL editor before
-- scripts/trends-import.mjs. Lets the importer upsert by supplier code, and
-- later hide products a supplier has dropped without touching manual ones.
alter table public.products
  add column if not exists supplier text,
  add column if not exists supplier_code text,
  add column if not exists supplier_updated_at timestamptz,
  add column if not exists imported_at timestamptz;

alter table public.products
  drop constraint if exists products_supplier_code_key;
alter table public.products
  add constraint products_supplier_code_key unique (supplier, supplier_code);
