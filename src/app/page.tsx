import Link from "next/link";
import { catalog } from "@/data/catalog";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-wide">BRANDSource</span>
          <nav className="flex gap-4 text-sm text-zinc-600">
            <a href="#products" className="hover:text-zinc-900">
              Trade Show products
            </a>
            <span className="text-zinc-400">NZ suppliers</span>
          </nav>
        </div>
      </header>

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
            <a
              href="#products"
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Browse Trade Show products
            </a>
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
              Pricing from PO quotes — shown as TBD until supplier rates land.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.map((p) => (
                <li
                  key={p.slug}
                  className="rounded-xl border border-zinc-200 p-5 hover:border-zinc-400"
                >
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="mt-2 text-sm text-zinc-600">
                    {p.short_description}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-wide text-zinc-400">
                    {p.min_order_qty > 1
                      ? `MOQ ${p.min_order_qty} · `
                      : ""}
                    Price TBD
                  </p>
                  <Link
                    href={`/products/${p.slug}`}
                    className="mt-3 inline-block text-sm font-medium text-zinc-900 underline-offset-2 hover:underline"
                  >
                    Configure
                  </Link>
                </li>
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
