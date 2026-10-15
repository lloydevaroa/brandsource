import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumb, CategoryTile, ProductCard } from "@/components/CategoryViews";
import { getCategories, type CategoryProduct } from "@/lib/categories";
import { matchesAll, searchRank, searchTokens } from "@/lib/search";

export const metadata = {
  title: "Search | BRANDSource",
  robots: { index: false },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  const tokens = searchTokens(q);
  const all = await getCategories();

  const products: CategoryProduct[] = [];
  const categories: typeof all = [];
  if (tokens.length > 0) {
    const seen = new Map<string, CategoryProduct>();
    for (const c of all) for (const p of c.products) if (!seen.has(p.slug)) seen.set(p.slug, p);
    products.push(
      ...[...seen.values()]
        .filter((p) => matchesAll(`${p.name} ${p.short_description}`, tokens))
        .sort(
          (a, b) =>
            searchRank(a.name, tokens, q) - searchRank(b.name, tokens, q) || a.name.localeCompare(b.name),
        ),
    );
    categories.push(...all.filter((c) => matchesAll(c.name, tokens)));
  }

  const total = products.length + categories.length;

  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Breadcrumb trail={[{ label: "Home", href: "/" }, { label: "Search" }]} />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {q ? <>Results for &ldquo;{q}&rdquo;</> : "Search our range"}
        </h1>

        {!q ? (
          <p className="mt-3 text-zinc-600">Type a product or category into the search field above.</p>
        ) : total === 0 ? (
          <div className="mt-6">
            <p className="text-zinc-600">Nothing matched &ldquo;{q}&rdquo;. Try a shorter or different word.</p>
            <Link
              href="/category/trade-show-and-events"
              className="mt-4 inline-block text-sm font-bold text-brand-orange hover:underline"
            >
              Browse all categories <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-500">
              {total} {total === 1 ? "result" : "results"}
            </p>
            {categories.length > 0 ? (
              <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((c) => (
                  <CategoryTile key={c.slug} category={c} />
                ))}
              </ul>
            ) : null}
            {products.length > 0 ? (
              <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </ul>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
