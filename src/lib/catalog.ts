import { cache } from "react";
import { createServiceSupabase } from "@/lib/supabase/server";
import {
  SUPPLIER_EMBED,
  isMissingSupplierSchema,
  isSupplierHidden,
  oneSupplier,
  sampleLabel,
  type SupplierEmbed,
} from "@/lib/suppliers";

export type ProductDetails = {
  features: string[];
  specifications: { name: string; value: string }[];
  materials: { component: string; material: string }[];
  dimensions: string[];
  branding_options: { type: string; areas: string[] }[];
  packaging: string;
  carton: { length_cm: number; width_cm: number; height_cm: number; weight_kg: number; quantity: number } | null;
  template_url: string | null;
  image_captions: string[];
};

export type CatalogProduct = {
  slug: string;
  name: string;
  short_description: string;
  unit_price: number | null;
  min_order_qty: number;
  example_image_urls: string[];
  product_details: ProductDetails | null;
  /** Badge text while the supplier is only a sample listing (e.g. "TLC sample"), else null. */
  sample_label: string | null;
  option_groups: {
    key: string; label: string; selection: "single" | "multi"; required: boolean;
    choices: { key: string; label: string; price_delta: number }[];
  }[];
};

type Row = {
  slug: string;
  name: string;
  short_description: string;
  unit_price: number | string | null;
  min_order_qty: number;
  example_image_urls: string[] | null;
  product_details: ProductDetails | null;
  supplier?: SupplierEmbed | SupplierEmbed[] | null;
  option_groups: {
    key: string; label: string; selection: "single" | "multi"; required: boolean; sort_order: number;
    option_choices: { key: string; label: string; price_delta: number | string; sort_order: number }[];
  }[];
};

/**
 * The product catalogue, read from Supabase (the source of truth). Server only.
 * Storefront and checkout use the default (active products only); reports pass
 * includeInactive so historical orders still resolve their option labels.
 */
export const getCatalog = cache(async (includeInactive = false): Promise<CatalogProduct[]> => {
  const supabase = createServiceSupabase();
  const base =
    "slug, name, short_description, unit_price, min_order_qty, example_image_urls, product_details, option_groups ( key, label, selection, required, sort_order, option_choices ( key, label, price_delta, sort_order ) )";
  const run = (cols: string) => {
    let query = supabase
      .from("products")
      .select(cols)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (!includeInactive) query = query.eq("active", true);
    return query;
  };

  let { data, error } = await run(`${base}, ${SUPPLIER_EMBED}`);
  // supabase/suppliers.sql not run yet: carry on without supplier rules.
  if (error && isMissingSupplierSchema(error.message)) ({ data, error } = await run(base));
  if (error) throw new Error(`Could not load catalogue: ${error.message}`);

  // Products from a withdrawn or inactive supplier are hidden everywhere except
  // reports, which still need them to resolve old orders.
  const rows = (data as unknown as Row[]).filter(
    (p) => includeInactive || !isSupplierHidden(oneSupplier(p.supplier))
  );

  return rows.map((p) => ({
    slug: p.slug,
    name: p.name,
    short_description: p.short_description,
    unit_price: p.unit_price === null ? null : Number(p.unit_price),
    min_order_qty: p.min_order_qty,
    example_image_urls: p.example_image_urls ?? [],
    product_details: p.product_details,
    sample_label: sampleLabel(oneSupplier(p.supplier)),
    option_groups: [...p.option_groups]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        key: g.key,
        label: g.label,
        selection: g.selection,
        required: g.required,
        choices: [...g.option_choices]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((c) => ({ key: c.key, label: c.label, price_delta: Number(c.price_delta) })),
      })),
  }));
});
