import { SiteHeader } from "@/components/SiteHeader";
import { CategoryTile } from "@/components/CategoryViews";
import { HeroSlider } from "@/components/HeroSlider";
import { getHeroSlides } from "@/lib/hero";
import { countProducts, getCategories, getChildren } from "@/lib/categories";

export const revalidate = 60;

export default async function Home() {
  const all = await getCategories();
  const slides = await getHeroSlides("home");
  const tiles = getChildren(all, "trade-show-and-events");
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <SiteHeader />

      <main>
        <HeroSlider slides={slides} />
        <section id="products" className="mx-auto max-w-5xl px-6 pb-14 pt-10 sm:pt-12">
          <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Customisable Events &amp; Trade Show Products
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-center text-zinc-600">
            Configure online, upload artwork, approve a human proof, then we
            print with NZ partners.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((c) => (
              <CategoryTile key={c.slug} category={c} productCount={countProducts(all, c)} />
            ))}
          </ul>
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
