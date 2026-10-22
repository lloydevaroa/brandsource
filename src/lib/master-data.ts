import { createServiceSupabase } from "@/lib/supabase/server";
import { getRateTiers, type RateTier } from "@/lib/rate-tiers";
import type { ProductSpec } from "@/lib/category-filters";

export type OverrideField = "description" | "rrp" | "categories";

/** A staff edit on a supplier product: what the supplier sends is kept beside the live value. */
export type FieldOverride = {
  /** Text, a number, or category slugs; null when the supplier has no value to compare. */
  supplierValue: string | number | string[] | null;
  editedAt: string;
  editedBy: string | null;
  needsReview: boolean;
  reviewNote: string | null;
};

/** One product as the team sees it on the master data page. Server only: carries supplier cost. */
export type MasterRow = {
  slug: string;
  /** True for products imported from the Trends API, which have a supplier value to compare against. */
  isTrends: boolean;
  overrides: Partial<Record<OverrideField, FieldOverride>>;
  name: string;
  image: string | null;
  /** The short description customers see under the product name. */
  description: string;
  supplier: string;
  supplierSlug: string;
  /** Whether customers can see it, and if not why not. */
  visibility: "live" | "sample" | "hidden";
  visibilityNote: string;
  /** Slugs of every category (parent or child) the product sits in. */
  categories: string[];
  availability: "stock" | "indent" | "unknown";
  /** Trends' own wording for how the supplier prices it, e.g. "Indent - Air". */
  availabilityDetail: string;
  moq: number;
  /** Selling price (RRP), ex GST. */
  rrp: number | null;
  /** Supplier cost at the lowest quantity break, ex GST. */
  cost: number | null;
  costQty: number | null;
  specs: ProductSpec[];
  supplierUpdatedAt: string | null;
};

export type MasterCategory = { slug: string; name: string; parent_slug: string | null; active: boolean };

export type MasterData = {
  rows: MasterRow[];
  categories: MasterCategory[];
  tiers: RateTier[];
  suppliers: { slug: string; name: string }[];
  /** True when the supplier cost tables are missing, so the cost column would be empty. */
  noCostTables: boolean;
  /** True when supabase/product-overrides.sql has not been run, so editing is switched off. */
  noEditTables: boolean;
};

type Result<T> = { data: T[] | null; error: { message: string } | null };

/** PostgREST caps a response at 1000 rows by default; walk the table in pages. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Result<T>>): Promise<Result<T>> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: null, error };
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return { data: out, error: null };
}

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  supplier: string | null;
  active: boolean;
  unit_price: number | string | null;
  min_order_qty: number;
  example_image_urls: string[] | null;
  supplier_id: string | null;
  supplier_updated_at: string | null;
  specs: ProductSpec[] | null;
};
type SupplierRow = { id: string; name: string; slug: string | null; listing_status: string; active: boolean };
type CategoryRow = { id: string; slug: string; name: string; parent_id: string | null; active: boolean };
type OverrideRow = {
  product_id: string;
  field: OverrideField;
  supplier_value: string | number | string[] | null;
  edited_by: string | null;
  edited_at: string;
  needs_review: boolean;
  review_note: string | null;
};
type LinkRow = { product_id: string; category_id: string };
type PricingRow = { product_id: string; price_type: string };
type BreakRow = { product_id: string; min_qty: number; unit_cost: number | string };

export async function getMasterData(): Promise<MasterData> {
  const supabase = createServiceSupabase();

  const [products, suppliers, categories, links, pricing, breaks, tiers, overrides, profiles] = await Promise.all([
    fetchAll<ProductRow>((from, to) =>
      supabase
        .from("products")
        .select(
          "id, slug, name, short_description, supplier, active, unit_price, min_order_qty, example_image_urls, supplier_id, supplier_updated_at, specs:product_details->specifications",
        )
        .order("name", { ascending: true })
        .range(from, to) as unknown as PromiseLike<Result<ProductRow>>,
    ),
    supabase.from("suppliers").select("id, name, slug, listing_status, active"),
    supabase.from("categories").select("id, slug, name, parent_id, active").order("sort_order", { ascending: true }),
    fetchAll<LinkRow>((from, to) =>
      supabase.from("product_categories").select("product_id, category_id").range(from, to) as unknown as PromiseLike<
        Result<LinkRow>
      >,
    ),
    fetchAll<PricingRow>((from, to) =>
      supabase.from("product_supplier_pricing").select("product_id, price_type").range(from, to) as unknown as PromiseLike<
        Result<PricingRow>
      >,
    ),
    fetchAll<BreakRow>((from, to) =>
      supabase
        .from("product_price_breaks")
        .select("product_id, min_qty, unit_cost")
        .order("min_qty", { ascending: true })
        .range(from, to) as unknown as PromiseLike<Result<BreakRow>>,
    ),
    getRateTiers().catch(() => [] as RateTier[]),
    fetchAll<OverrideRow>((from, to) =>
      supabase
        .from("product_overrides")
        .select("product_id, field, supplier_value, edited_by, edited_at, needs_review, review_note")
        .range(from, to) as unknown as PromiseLike<Result<OverrideRow>>,
    ),
    supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "manager"]),
  ]);

  if (products.error) throw new Error(`Could not load products: ${products.error.message}`);
  if (suppliers.error) throw new Error(`Could not load suppliers: ${suppliers.error.message}`);
  if (categories.error) throw new Error(`Could not load categories: ${categories.error.message}`);
  if (links.error) throw new Error(`Could not load product categories: ${links.error.message}`);

  // The cost tables come from supabase/supplier-pricing.sql; carry on without them if it has not been run.
  const noCostTables = Boolean(pricing.error || breaks.error);

  // The override table comes from supabase/product-overrides.sql; the page is read-only until it has been run.
  const noEditTables = Boolean(overrides.error);
  const staffName = new Map(
    ((profiles.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [
      p.id,
      p.full_name || p.email || "Staff",
    ]),
  );
  const overridesOf = new Map<string, MasterRow["overrides"]>();
  for (const o of overrides.data ?? []) {
    const cur = overridesOf.get(o.product_id) ?? {};
    cur[o.field] = {
      supplierValue: o.supplier_value,
      editedAt: o.edited_at,
      editedBy: o.edited_by ? (staffName.get(o.edited_by) ?? "Staff") : null,
      needsReview: o.needs_review,
      reviewNote: o.review_note,
    };
    overridesOf.set(o.product_id, cur);
  }

  const supplierById = new Map((suppliers.data as SupplierRow[]).map((s) => [s.id, s]));
  const catRows = categories.data as CategoryRow[];
  const slugById = new Map(catRows.map((c) => [c.id, c.slug]));

  const categoriesOf = new Map<string, string[]>();
  for (const l of links.data ?? []) {
    const slug = slugById.get(l.category_id);
    if (!slug) continue;
    categoriesOf.set(l.product_id, [...(categoriesOf.get(l.product_id) ?? []), slug]);
  }

  const priceType = new Map((pricing.data ?? []).map((p) => [p.product_id, p.price_type]));
  // Breaks arrive in quantity order, so the first one seen per product is the lowest quantity.
  const firstBreak = new Map<string, BreakRow>();
  for (const b of breaks.data ?? []) if (!firstBreak.has(b.product_id)) firstBreak.set(b.product_id, b);

  const rows: MasterRow[] = (products.data ?? []).map((p) => {
    const s = p.supplier_id ? supplierById.get(p.supplier_id) : undefined;
    const images = p.example_image_urls ?? [];

    let visibility: MasterRow["visibility"] = "live";
    let visibilityNote = "Live on the website";
    if (!p.active) {
      visibility = "hidden";
      visibilityNote = "Product is switched off";
    } else if (s && (!s.active || s.listing_status === "withdrawn")) {
      visibility = "hidden";
      visibilityNote = "Supplier is withdrawn or inactive";
    } else if (images.length === 0) {
      visibility = "hidden";
      visibilityNote = "No image, so the website leaves it out";
    } else if (s?.listing_status === "sample") {
      visibility = "sample";
      visibilityNote = "Live with a sample badge until the supplier approves";
    }

    const type = priceType.get(p.id);
    const availability: MasterRow["availability"] = !type
      ? "unknown"
      : /indent/i.test(type)
        ? "indent"
        : "stock";
    const brk = firstBreak.get(p.id);

    return {
      slug: p.slug,
      isTrends: p.supplier === "trends",
      overrides: overridesOf.get(p.id) ?? {},
      name: p.name,
      description: p.short_description ?? "",
      image: images[0] ?? null,
      supplier: s?.name ?? "No supplier",
      supplierSlug: s?.slug ?? "none",
      visibility,
      visibilityNote,
      categories: categoriesOf.get(p.id) ?? [],
      availability,
      availabilityDetail: type ?? "",
      moq: p.min_order_qty,
      rrp: p.unit_price === null ? null : Number(p.unit_price),
      cost: brk ? Number(brk.unit_cost) : null,
      costQty: brk?.min_qty ?? null,
      specs: Array.isArray(p.specs)
        ? p.specs.filter((x) => typeof x?.name === "string" && typeof x?.value === "string")
        : [],
      supplierUpdatedAt: p.supplier_updated_at,
    };
  });

  const supplierList = [...new Map(rows.map((r) => [r.supplierSlug, r.supplier])).entries()]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows,
    categories: catRows.map((c) => ({
      slug: c.slug,
      name: c.name,
      parent_slug: c.parent_id ? (slugById.get(c.parent_id) ?? null) : null,
      active: c.active,
    })),
    tiers,
    suppliers: supplierList,
    noCostTables,
    noEditTables,
  };
}
