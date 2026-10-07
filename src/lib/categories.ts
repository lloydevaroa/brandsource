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

export type CategoryProduct = {
  slug: string;
  name: string;
  short_description: string;
  unit_price: number | null;
  min_order_qty: number;
  image: string | null;
  sample_label: string | null; // badge text while the supplier is only a sample listing
};

export type Category = {
  slug: string;
  name: string;
  parent_slug: string | null;
  image: string | null; // own image, else the first product's, else null
  products: CategoryProduct[];
};

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  image_url: string | null;
};

type LinkRow = {
  category_id: string;
  products: {
    slug: string;
    name: string;
    short_description: string;
    unit_price: number | string | null;
    min_order_qty: number;
    example_image_urls: string[] | null;
    sort_order: number;
    supplier?: SupplierEmbed | SupplierEmbed[] | null;
  };
};

/**
 * Every active category with the active products assigned to it, in display
 * order. Server only. Categories are shown only when a supplier SKU backs them:
 * a category with no products (and no subcategory with products) is left out
 * entirely, and appears by itself once a product is assigned.
 */
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = createServiceSupabase();

  const productCols = "slug, name, short_description, unit_price, min_order_qty, example_image_urls, sort_order";
  const loadLinks = (cols: string) =>
    supabase
      .from("product_categories")
      .select(`category_id, products!inner ( ${cols} )`)
      .eq("products.active", true);

  const [cats, firstLinks] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, parent_id, image_url")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    loadLinks(`${productCols}, ${SUPPLIER_EMBED}`),
  ]);
  // supabase/suppliers.sql not run yet: carry on without supplier rules.
  const links =
    firstLinks.error && isMissingSupplierSchema(firstLinks.error.message)
      ? await loadLinks(productCols)
      : firstLinks;
  if (cats.error) throw new Error(`Could not load categories: ${cats.error.message}`);
  if (links.error) throw new Error(`Could not load category products: ${links.error.message}`);

  const rows = cats.data as CategoryRow[];
  const slugById = new Map(rows.map((c) => [c.id, c.slug]));

  const byCategory = new Map<string, LinkRow["products"][]>();
  for (const l of links.data as unknown as LinkRow[]) {
    if (isSupplierHidden(oneSupplier(l.products.supplier))) continue;
    const list = byCategory.get(l.category_id) ?? [];
    list.push(l.products);
    byCategory.set(l.category_id, list);
  }

  const built = rows.map((c) => {
    const products = (byCategory.get(c.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        short_description: p.short_description,
        unit_price: p.unit_price === null ? null : Number(p.unit_price),
        min_order_qty: p.min_order_qty,
        image: p.example_image_urls?.[0] ?? null,
        sample_label: sampleLabel(oneSupplier(p.supplier)),
      }));
    return {
      slug: c.slug,
      name: c.name,
      parent_slug: c.parent_id ? (slugById.get(c.parent_id) ?? null) : null,
      image: c.image_url ?? products.find((p) => p.image)?.image ?? null,
      products,
    };
  });

  const hasProducts = (c: Category): boolean =>
    c.products.length > 0 || built.some((k) => k.parent_slug === c.slug && k.products.length > 0);
  return built.filter(hasProducts);
});

export const getChildren = (all: Category[], slug: string) =>
  all.filter((c) => c.parent_slug === slug);

/** Products in a category, counting its subcategories (so a group shows its total). */
export function countProducts(all: Category[], c: Category): number {
  const seen = new Set(c.products.map((p) => p.slug));
  for (const child of getChildren(all, c.slug)) {
    for (const p of child.products) seen.add(p.slug);
  }
  return seen.size;
}

/** The first category a product sits in, for breadcrumbs on the product page. */
export function categoryForProduct(all: Category[], productSlug: string): Category | undefined {
  return all.find((c) => c.parent_slug && c.products.some((p) => p.slug === productSlug));
}

/**
 * Header menu: the horizontal items are the sub-categories (or a top-level
 * category with no sub-categories), each with its products as the dropdown.
 * Categories with no products are left out.
 */
export async function getMenuCategories(): Promise<
  { slug: string; name: string; products: { slug: string; name: string }[] }[]
> {
  try {
    const all = await getCategories();
    const items: Category[] = [];
    for (const top of all.filter((c) => !c.parent_slug)) {
      const kids = getChildren(all, top.slug);
      items.push(...(kids.length > 0 ? kids : [top]));
    }
    return items
      .filter((c) => c.products.length > 0)
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        products: c.products.map((p) => ({ slug: p.slug, name: p.name })),
      }));
  } catch {
    return [];
  }
}
