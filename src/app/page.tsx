import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CategoryTile } from "@/components/CategoryViews";
import { countProducts, getCategories, getChildren } from "@/lib/categories";

export const revalidate = 60;

export default async function Home() {
  const all = await getCategories();
  const tiles = getChildren(all, "trade-show-and-events");
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Trade Show &amp; Events · NZ suppliers
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Branded event merch, fulfilled in New Zealand
          </h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-600">
            Configure online, upload artwork, approve a human proof — then we
            print with NZ partners. Flat, clear pricing.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/category/trade-show-and-events"
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Browse Trade Show products
            </Link>
            <span className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700">
              Get a quote
            </span>
          </div>
        </section>

        <section id="products" className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-xl font-semibold tracking-tight">
              Trade Show &amp; Events
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Pick a category to see the range.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tiles.map((c) => (
                <CategoryTile key={c.slug} category={c} productCount={countProducts(all, c)} />
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-zinc-200">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <p className="text-sm font-medium text-zinc-500">Proofing</p>
            <p className="mt-2 text-lg text-zinc-800">
              Upload → we proof → you approve. Sample imagery only until then.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-8 text-center text-xs text-zinc-500">
        BRANDSource · NZ-fulfilled branded merchandise · V1 pilot scaffold
      </footer>
    </div>
  );
}
