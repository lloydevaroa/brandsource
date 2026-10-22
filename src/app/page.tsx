import { Fragment } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CategoryTile } from "@/components/CategoryViews";
import { HeroSlider } from "@/components/HeroSlider";
import { getHeroSlides, getHomeFeaturedSlides } from "@/lib/hero";
import { getCategories, getChildren } from "@/lib/categories";

export const revalidate = 60;

/**
 * The featured band goes after the first row of category tiles. A row is 4 tiles at lg, 5 at xl and 6 at 2xl; below
 * lg (phones and tablets) it goes after the first 6. The band sits in the DOM after tile 6 and CSS `order` moves it
 * up at lg and xl by pushing the one or two tiles that fall after it, and the rest, behind it.
 */
const FEATURED_AFTER = 6;

function tileOrder(i: number, hasBand: boolean): string | undefined {
  if (!hasBand) return undefined;
  if (i < 4) return undefined;
  if (i === 4) return "lg:order-2 xl:order-none";
  if (i === 5) return "lg:order-2 2xl:order-none";
  return "order-2";
}

export default async function Home() {
  const all = await getCategories();
  const slides = await getHeroSlides("home");
  const featured = await getHomeFeaturedSlides();
  const tiles = getChildren(all, "trade-show-and-events");
  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />

      <main>
        <HeroSlider slides={slides} />
        <section id="products" className="mx-auto max-w-[90rem] px-6 pb-14 pt-12">
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
          <p className="mt-3 max-w-3xl text-balance text-zinc-600">
            Configure online, upload artwork, approve a human proof, then we
            print with our partners.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {tiles.map((c, i) => (
              <Fragment key={c.slug}>
                {i === FEATURED_AFTER && featured.length > 0 ? (
                  <li className="order-1 col-span-full">
                    <HeroSlider slides={featured} inline />
                  </li>
                ) : null}
                <CategoryTile category={c} className={tileOrder(i, featured.length > 0)} />
              </Fragment>
            ))}
            {featured.length > 0 && tiles.length <= FEATURED_AFTER ? (
              <li className="order-1 col-span-full">
                <HeroSlider slides={featured} inline />
              </li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}
