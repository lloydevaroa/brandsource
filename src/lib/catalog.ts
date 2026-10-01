import { cache } from "react";
import { createServiceSupabase } from "@/lib/supabase/server";

export type CatalogProduct = {
  slug: string;
  name: string;
  short_description: string;
  unit_price: number | null;
  min_order_qty: number;
  example_image_urls: string[];
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
  let query = supabase
    .from("products")
    .select(
      "slug, name, short_description, unit_price, min_order_qty, example_image_urls, option_groups ( key, label, selection, required, sort_order, option_choices ( key, label, price_delta, sort_order ) )"
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load catalogue: ${error.message}`);

  return (data as unknown as Row[]).map((p) => ({
    slug: p.slug,
    name: p.name,
    short_description: p.short_description,
    unit_price: p.unit_price === null ? null : Number(p.unit_price),
    min_order_qty: p.min_order_qty,
    example_image_urls: p.example_image_urls ?? [],
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
