import { cache } from "react";
import { createServiceSupabase } from "@/lib/supabase/server";

export type CategoryProduct = {
  slug: string;
  name: string;
  short_description: string;
  unit_price: number | null;
  min_order_qty: number;
  image: string | null;
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
  };
};

/**
 * Every active category with the active products assigned to it, in display
 * order. Server only. A category with no products is "coming soon" on the
 * storefront; it fills in by itself once a product is assigned.
 */
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = createServiceSupabase();

  const [cats, links] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, parent_id, image_url")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("product_categories")
      .select(
        "category_id, products!inner ( slug, name, short_description, unit_price, min_order_qty, example_image_urls, sort_order )"
      )
      .eq("products.active", true),
  ]);
  if (cats.error) throw new Error(`Could not load categories: ${cats.error.message}`);
  if (links.error) throw new Error(`Could not load category products: ${links.error.message}`);

  const rows = cats.data as CategoryRow[];
  const slugById = new Map(rows.map((c) => [c.id, c.slug]));

  const byCategory = new Map<string, LinkRow["products"][]>();
  for (const l of links.data as unknown as LinkRow[]) {
    const list = byCategory.get(l.category_id) ?? [];
    list.push(l.products);
    byCategory.set(l.category_id, list);
  }

  return rows.map((c) => {
    const products = (byCategory.get(c.id) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        short_description: p.short_description,
        unit_price: p.unit_price === null ? null : Number(p.unit_price),
        min_order_qty: p.min_order_qty,
        image: p.example_image_urls?.[0] ?? null,
      }));
    return {
      slug: c.slug,
      name: c.name,
      parent_slug: c.parent_id ? (slugById.get(c.parent_id) ?? null) : null,
      image: c.image_url ?? products.find((p) => p.image)?.image ?? null,
      products,
    };
  });
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
