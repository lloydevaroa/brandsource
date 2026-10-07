import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CategoryTile } from "@/components/CategoryViews";
import { HeroSlider } from "@/components/HeroSlider";
import { getHeroSlides } from "@/lib/hero";
import { getCategories, getChildren } from "@/lib/categories";

export const revalidate = 60;

export default async function Home() {
  const all = await getCategories();
  const slides = await getHeroSlides("home");
  const tiles = getChildren(all, "trade-show-and-events");
  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />

      <main>
        <HeroSlider slides={slides} />
        <section id="products" className="mx-auto max-w-6xl px-6 pb-14 pt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Shop by category
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Customisable Events &amp; Trade Show Products
              </h1>
            </div>
            <Link
              href="/category/trade-show-and-events"
              className="hidden shrink-0 text-sm font-bold text-brand-orange hover:underline sm:block"
            >
              View all categories <span aria-hidden>&rarr;</span>
            </Link>
          </div>
          <p className="mt-3 max-w-xl text-zinc-600">
            Configure online, upload artwork, approve a human proof, then we
            print with NZ partners.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map((c) => (
              <CategoryTile key={c.slug} category={c} />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
