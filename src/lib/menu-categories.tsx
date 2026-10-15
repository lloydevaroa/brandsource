"use client";

import { createContext, useContext } from "react";

export type MenuCategory = {
  slug: string;
  name: string;
  products: { slug: string; name: string }[];
};

const MenuCategoriesContext = createContext<MenuCategory[]>([]);

export function MenuCategoriesProvider({
  categories,
  children,
}: {
  categories: MenuCategory[];
  children: React.ReactNode;
}) {
  return (
    <MenuCategoriesContext.Provider value={categories}>{children}</MenuCategoriesContext.Provider>
  );
}

export const useMenuCategories = () => useContext(MenuCategoriesContext);

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
