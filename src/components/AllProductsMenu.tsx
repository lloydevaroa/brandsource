"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Chevron } from "@/components/Chevron";
import { useMenuCategories } from "@/lib/menu-categories";

/**
 * "All products" item for the desktop category bar: opens a full-width panel
 * of every product, grouped by category (in the bar's order). Opens on hover or click; closes on Escape, an
 * outside click, or picking a product. The bar (`nav`) must be `relative`, as
 * the panel is positioned against it, not against this item.
 */
export function AllProductsMenu({ itemClassName = "" }: { itemClassName?: string }) {
  const categories = useMenuCategories();
  const panelId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  // The bar wraps onto several rows, so the panel starts at the bottom of this
  // item's row, not the bottom of the bar. Otherwise the pointer crosses the
  // next row on its way down and that row's own dropdowns steal the hover.
  // It overlaps the row by a couple of pixels so fractional row heights can't
  // leave a hairline gap that the next row's links catch.
  const [top, setTop] = useState(0);

  function openPanel() {
    const el = itemRef.current;
    if (el) setTop(el.offsetTop + el.offsetHeight - 2);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!itemRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  if (categories.length === 0) return null;

  return (
    <li
      ref={itemRef}
      onMouseEnter={openPanel}
      onMouseLeave={() => setOpen(false)}
      className="flex self-stretch"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={openPanel}
        className={`${itemClassName} ${open ? "text-brand-orange" : ""}`}
      >
        All products
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          id={panelId}
          style={{ top }}
          className="absolute inset-x-0 z-30 border-t-2 border-brand-orange bg-white text-brand-charcoal shadow-lg"
        >
          <div className="mx-auto max-h-[70vh] max-w-[90rem] overflow-y-auto px-6 py-6">
            <div className="columns-2 gap-x-10 lg:columns-4">
              {categories.map((c) => (
                <section key={c.slug} className="mb-6">
                  <h3 className="break-after-avoid border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wide text-brand-orange">
                    <Link
                      href={`/category/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </h3>
                  <ul className="mt-2">
                    {c.products.map((p) => (
                      <li key={p.slug}>
                        <Link
                          href={`/products/${p.slug}`}
                          onClick={() => setOpen(false)}
                          className="block py-1 text-[13px] font-medium text-zinc-700 hover:text-zinc-900"
                        >
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
