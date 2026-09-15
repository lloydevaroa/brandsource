"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartArtworkFile = {
  path: string;
  filename: string;
};

export type CartItem = {
  id: string;
  productSlug: string;
  productName: string;
  configuration: Record<string, string | string[]>;
  quantity: number;
  artwork: CartArtworkFile[];
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "id" | "artwork">) => string;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  addArtwork: (id: string, file: CartArtworkFile) => void;
  removeArtwork: (id: string, path: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "brandsource:cart:v1";

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "id" | "artwork">) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((prev) => [...prev, { ...item, id, artwork: [] }]);
    return id;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i))
    );
  }, []);

  const addArtwork = useCallback((id: string, file: CartArtworkFile) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, artwork: [...i.artwork, file] } : i))
    );
  }, []);

  const removeArtwork = useCallback((id: string, path: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, artwork: i.artwork.filter((a) => a.path !== path) } : i
      )
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, addArtwork, removeArtwork, clear }),
    [items, addItem, removeItem, updateQuantity, addArtwork, removeArtwork, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
