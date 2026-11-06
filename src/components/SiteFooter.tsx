"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMenuCategories } from "@/lib/menu-categories";

const VALUE_POINTS = [
  { title: "Configure online", text: "Choose options and upload your artwork.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg> },
  { title: "Human proofing", text: "A real person checks every proof before print.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10"/></svg> },
  { title: "NZ support & contact", text: "A local NZ team to talk to about every order.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/></svg> },
  { title: "Flat, clear pricing", text: "Know the price before you order.", icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M16.5 7.5C15.5 6.5 14 6 12 6c-2.5 0-4 1-4 2.5S9.5 11 12 11.5s4 1.2 4 3S14.5 18 12 18c-2 0-3.5-.5-4.5-1.5"/></svg> },
];

const CONTACT_EMAIL = "orders@brandsource.co.nz";
const CONTACT_PHONE = "09 377 4110";
const CONTACT_PHONE_TEL = "+6493774110";
const MAX_CATEGORIES = 8;
const LINK = "hover:text-brand-orange focus-visible:text-brand-orange";

export function SiteFooter() {
  const pathname = usePathname();
  const categories = useMenuCategories();
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer>
      <section className="border-y border-zinc-200 bg-brand-peach text-brand-charcoal">
        <ul className="mx-auto grid max-w-[90rem] gap-6 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="bg-brand-charcoal pt-12 text-sm text-zinc-300">
        <div className="mx-auto grid max-w-[90rem] gap-10 px-6 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Image
              src="/brand/BrandSource-Reversed.svg"
              alt="BRANDSource"
              width={822}
              height={74}
              className="h-5 w-auto"
              unoptimized
            />
            <p className="mt-4 max-w-xs leading-relaxed">
              Branded merchandise for trade shows and events, fulfilled in New Zealand.
            </p>
          </div>

          <nav aria-label="Shop">
            <h2 className="text-xs font-bold uppercase tracking-wide text-white">Shop</h2>
            <ul className="mt-4 space-y-2">
              {categories.slice(0, MAX_CATEGORIES).map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className={LINK}>
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/search" className={LINK}>
                  Search all products
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Your account">
            <h2 className="text-xs font-bold uppercase tracking-wide text-white">Your account</h2>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/account" className={LINK}>
                  Account and orders
                </Link>
              </li>
              <li>
                <Link href="/cart" className={LINK}>
                  Cart
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-white">Contact</h2>
            <p className="mt-4 leading-relaxed">Talk to our NZ team about any order.</p>
            <p className="mt-2">
              <a href={`tel:${CONTACT_PHONE_TEL}`} className={LINK}>
                {CONTACT_PHONE}
              </a>
            </p>
            <p className="mt-2">
              <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 py-6 text-xs text-zinc-400">
          <div className="mx-auto max-w-[90rem] px-6">
            <p>© {new Date().getFullYear()} BRANDSource. Prices exclude GST.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
