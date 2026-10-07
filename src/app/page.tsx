import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { CategoryTile } from "@/components/CategoryViews";
import { HeroSlider } from "@/components/HeroSlider";
import { getHeroSlides } from "@/lib/hero";
import { getCategories, getChildren } from "@/lib/categories";

const VALUE_POINTS = [
  { title: "Configure online", text: "Choose options and upload your artwork.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg> },
  { title: "Human proofing", text: "A real person checks every proof before print.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10"/></svg> },
  { title: "NZ support & contact", text: "A local NZ team to talk to about every order.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/></svg> },
  { title: "Flat, clear pricing", text: "Know the price before you order.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M16.5 7.5C15.5 6.5 14 6 12 6c-2.5 0-4 1-4 2.5S9.5 11 12 11.5s4 1.2 4 3S14.5 18 12 18c-2 0-3.5-.5-4.5-1.5"/></svg> },
];

export const revalidate = 60;

export default async function Home() {
  const all = await getCategories();
  const slides = await getHeroSlides("home");
  const tiles = getChildren(all, "trade-show-and-events");
  return (
    <div className="min-h-screen bg-brand-grey text-brand-charcoal">
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

        <section className="border-y border-zinc-200 bg-white">
          <ul className="mx-auto grid max-w-6xl gap-6 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_POINTS.map((v) => (
              <li key={v.title} className="flex items-start gap-3">
                <span className="mt-0.5 text-brand-charcoal" aria-hidden>
                  {v.icon}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide">{v.title}</p>
                  <p className="mt-1 text-sm text-zinc-600">{v.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="bg-brand-charcoal py-10 text-center text-xs text-zinc-400">
        <Image
          src="/brand/BrandSource-Reversed.svg"
          alt="BRANDSource"
          width={822}
          height={74}
          className="mx-auto h-5 w-auto"
          unoptimized
        />
        <p className="mt-4">NZ-fulfilled branded merchandise · V1 pilot scaffold</p>
      </footer>
    </div>
  );
}
