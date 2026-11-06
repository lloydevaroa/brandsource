"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type MenuCategory = {
  slug: string;
  name: string;
  /** True when the category has products, known straight away (the lists themselves load after the page). */
  hasProducts: boolean;
  /** Empty until the product lists have loaded. */
  products: { slug: string; name: string }[];
};

/** What the server sends with every page: the menu items only. */
export type LightMenuCategory = { slug: string; name: string; hasProducts: boolean };

type MenuIndex = {
  categories: { slug: string; name: string; productIds: number[] }[];
  products: { slug: string; name: string }[];
};

const MenuCategoriesContext = createContext<MenuCategory[]>([]);
const EnsureMenuProductsContext = createContext<() => void>(() => {});

/**
 * Menu items arrive with the page; the product lists (hundreds of KB) are fetched once the page is
 * idle, or sooner when search or a menu asks for them, and are cached by the CDN.
 */
export function MenuCategoriesProvider({
  categories,
  children,
}: {
  categories: LightMenuCategory[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState<MenuIndex | null>(null);
  const started = useRef(false);

  const ensure = useCallback(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/menu-products")
      .then((res) => (res.ok ? (res.json() as Promise<MenuIndex>) : Promise.reject(new Error("menu"))))
      .then(setIndex)
      .catch(() => {
        // Try again next time something asks; the menu items still work without the lists.
        started.current = false;
      });
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(ensure, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(ensure, 1500);
    return () => window.clearTimeout(id);
  }, [categories.length, ensure]);

  const full = useMemo<MenuCategory[]>(() => {
    const byCategory = new Map(index?.categories.map((c) => [c.slug, c.productIds]));
    return categories.map((c) => ({
      ...c,
      products: (byCategory.get(c.slug) ?? []).flatMap((id) => {
        const p = index?.products[id];
        return p ? [p] : [];
      }),
    }));
  }, [categories, index]);

  return (
    <EnsureMenuProductsContext.Provider value={ensure}>
      <MenuCategoriesContext.Provider value={full}>{children}</MenuCategoriesContext.Provider>
    </EnsureMenuProductsContext.Provider>
  );
}

export const useMenuCategories = () => useContext(MenuCategoriesContext);
/** Start loading the product lists now (search focus, menu hover). Safe to call repeatedly. */
export const useEnsureMenuProducts = () => useContext(EnsureMenuProductsContext);

export type AzGroup = {
  letter: string; // "A" to "Z", or "0-9" for names that start with a digit
  products: { slug: string; name: string }[];
};

/** Every product once (a product can sit in several categories), grouped by first letter, A to Z. */
export function groupProductsAz(categories: MenuCategory[]): AzGroup[] {
  const seen = new Map<string, { slug: string; name: string }>();
  for (const c of categories) {
    for (const p of c.products) if (!seen.has(p.slug)) seen.set(p.slug, p);
  }
  const sorted = [...seen.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en-NZ", { sensitivity: "base", numeric: true }),
  );
  const groups = new Map<string, AzGroup>();
  for (const p of sorted) {
    const first = p.name.trim().charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "0-9";
    const group = groups.get(letter) ?? { letter, products: [] };
    group.products.push(p);
    groups.set(letter, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.letter === "0-9" ? -1 : b.letter === "0-9" ? 1 : a.letter.localeCompare(b.letter),
  );
}
