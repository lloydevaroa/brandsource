"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Chevron } from "@/components/Chevron";
import { AllProductsMenu } from "@/components/AllProductsMenu";
import { useMenuCategories } from "@/lib/menu-categories";

const ITEM = "flex items-center gap-1.5 whitespace-nowrap px-3.5 py-3 hover:text-brand-orange";

/**
 * Desktop category bar: All products, then as many categories as fit on one
 * row, then a "More" dropdown holding the rest. A hidden copy of the row is
 * measured to work out how many fit, so the visible row never wraps.
 */
export function CategoryBar() {
  const categories = useMenuCategories();
  const barRef = useRef<HTMLUListElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const measure = measureRef.current;
    if (!bar || !measure) return;

    function recompute() {
      if (!bar || !measure) return;
      const widths = Array.from(measure.children).map((el) => (el as HTMLElement).offsetWidth);
      // widths: [All products, ...categories, More]
      const allW = widths[0] ?? 0;
      const moreW = widths[widths.length - 1] ?? 0;
      const cats = widths.slice(1, -1);
      const avail = bar.clientWidth;
      const total = allW + cats.reduce((a, b) => a + b, 0);
      if (total <= avail) {
        setFit(cats.length);
        return;
      }
      let used = allW + moreW;
      let n = 0;
      for (const w of cats) {
        if (used + w > avail) break;
        used += w;
        n += 1;
      }
      setFit(n);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [categories]);

  if (categories.length === 0) return null;

  const shown = fit === null ? [] : categories.slice(0, fit);
  const hidden = fit === null ? [] : categories.slice(fit);

  return (
    <nav
      aria-label="Product categories"
      className="relative hidden border-t border-white/10 bg-brand-charcoal-soft text-[13px] font-semibold text-white sm:block"
    >
      <ul
        ref={barRef}
        className={`mx-auto flex max-w-[90rem] items-center px-3 ${fit === null ? "invisible" : ""}`}
      >
        <AllProductsMenu itemClassName={ITEM} />
        {shown.map((c, i) => (
          <li key={c.slug} className="group relative">
            <Link href={`/category/${c.slug}`} className={ITEM}>
              {c.name}
              {c.products.length > 0 ? <Chevron /> : null}
            </Link>
            {c.products.length > 0 ? (
              <ul className={`invisible absolute ${i >= shown.length - 2 ? "right-0" : "left-0"} top-full z-20 min-w-56 border-t-2 border-brand-orange bg-white py-2 text-brand-charcoal opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100`}>
                {c.products.map((k) => (
                  <li key={k.slug}>
                    <Link
                      href={`/products/${k.slug}`}
                      className="block px-4 py-1.5 font-medium hover:bg-zinc-50 hover:text-brand-orange"
                    >
                      {k.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {hidden.length > 0 ? (
          <li className="group relative">
            <button type="button" className={ITEM}>
              More
              <Chevron />
            </button>
            <ul className="invisible absolute right-0 top-full z-20 min-w-56 border-t-2 border-brand-orange bg-white py-2 text-brand-charcoal opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {hidden.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="block px-4 py-1.5 font-medium hover:bg-zinc-50 hover:text-brand-orange"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>

      {/* Measuring copy of the row: not shown, not focusable. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex h-0 overflow-hidden"
      >
        <span className={ITEM}>
          All products
          <Chevron />
        </span>
        {categories.map((c) => (
          <span key={c.slug} className={ITEM}>
            {c.name}
            {c.products.length > 0 ? <Chevron /> : null}
          </span>
        ))}
        <span className={ITEM}>
          More
          <Chevron />
        </span>
      </div>
    </nav>
  );
}
