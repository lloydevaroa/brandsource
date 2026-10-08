import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../staff-guard";
import { ProductImageCard } from "./ProductImageCard";
import { BulkUploader } from "./BulkUploader";

type Row = {
  slug: string;
  name: string;
  example_image_urls: string[] | null;
  supplier: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export default async function ProductImagesPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; q?: string; empty?: string }>;
}) {
  const staffResult = await requireStaffProfile("Product images");
  if ("guard" in staffResult) return staffResult.guard;

  const { supplier: supplierParam, q = "", empty } = await searchParams;
  const { data, error } = await createServiceSupabase()
    .from("products")
    .select("slug, name, example_image_urls, supplier:suppliers ( name, slug )")
    .order("name", { ascending: true });
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Product images</h1>
        <p className="mt-2 text-red-600">Could not load: {error.message}</p>
      </div>
    );
  }

  const products = (data as unknown as Row[]).map((p) => {
    const s = Array.isArray(p.supplier) ? p.supplier[0] : p.supplier;
    return {
      slug: p.slug,
      name: p.name,
      supplier: s?.name ?? "No supplier",
      supplierSlug: s?.slug ?? "none",
      images: p.example_image_urls ?? [],
    };
  });

  const suppliers = [...new Map(products.map((p) => [p.supplierSlug, p.supplier])).entries()];
  // Trends supplies its own images, so the default view shows everyone else.
  const filter = supplierParam ?? "others";
  const needle = q.trim().toLowerCase();
  const shown = products
    .filter((p) => (filter === "all" ? true : filter === "others" ? p.supplierSlug !== "trends" : p.supplierSlug === filter))
    .filter((p) => (empty ? p.images.length === 0 : true))
    .filter((p) => !needle || p.name.toLowerCase().includes(needle));

  const chip = (active: boolean) =>
    `inline-block rounded-full border px-3 py-1.5 text-sm ${
      active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
    }`;
  const emptyQs = empty ? "&empty=1" : "";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Product images</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Add, reorder or remove the photos on a product page. The first image is the main one. By default this
          shows suppliers other than Trends, whose images come from their catalogue.
        </p>

        <BulkUploader products={products.map((p) => ({ slug: p.slug, name: p.name }))} />

        <ul className="mt-8 flex flex-wrap gap-2">
          <li><Link href={`/admin/product-images?supplier=others${emptyQs}`} className={chip(filter === "others")}>Non-Trends</Link></li>
          <li><Link href={`/admin/product-images?supplier=all${emptyQs}`} className={chip(filter === "all")}>All</Link></li>
          {suppliers.map(([slug, name]) => (
            <li key={slug}>
              <Link href={`/admin/product-images?supplier=${slug}${emptyQs}`} className={chip(filter === slug)}>{name}</Link>
            </li>
          ))}
          <li>
            <Link
              href={`/admin/product-images?supplier=${filter}${empty ? "" : "&empty=1"}`}
              className={chip(Boolean(empty))}
            >
              Missing images only
            </Link>
          </li>
        </ul>

        <form className="mt-4">
          <input type="hidden" name="supplier" value={filter} />
          {empty ? <input type="hidden" name="empty" value="1" /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search products"
            className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
        </form>

        <p className="mt-4 text-sm text-zinc-500">{shown.length} products</p>
        <ul className="mt-3 space-y-4">
          {shown.map((p) => (
            <ProductImageCard key={p.slug} product={p} />
          ))}
        </ul>
      </div>
    </div>
  );
}
