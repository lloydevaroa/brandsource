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
