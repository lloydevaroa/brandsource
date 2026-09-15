"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CatalogProduct } from "@/data/catalog";
import { useCart } from "@/lib/cart";

export function ProductConfigurator({ product }: { product: CatalogProduct }) {
  const { addItem } = useCart();
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [quantity, setQuantity] = useState(product.min_order_qty);
  const [justAdded, setJustAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingRequired = useMemo(() => {
    return product.option_groups
      .filter((g) => g.required)
      .filter((g) => {
        const value = selections[g.key];
        return g.selection === "multi" ? false : !value;
      });
  }, [product.option_groups, selections]);

  function setSingle(groupKey: string, choiceKey: string) {
    setSelections((prev) => ({ ...prev, [groupKey]: choiceKey }));
    setJustAdded(false);
  }

  function toggleMulti(groupKey: string, choiceKey: string) {
    setSelections((prev) => {
      const current = prev[groupKey];
      const list = Array.isArray(current) ? current : [];
      const next = list.includes(choiceKey)
        ? list.filter((k) => k !== choiceKey)
        : [...list, choiceKey];
      return { ...prev, [groupKey]: next };
    });
    setJustAdded(false);
  }

  function handleAddToCart() {
    if (missingRequired.length > 0) {
      setError(`Choose an option for: ${missingRequired.map((g) => g.label).join(", ")}`);
      return;
    }
    setError(null);
    addItem({
      productSlug: product.slug,
      productName: product.name,
      configuration: selections,
      quantity,
    });
    setJustAdded(true);
  }

  return (
    <form
      className="mt-10 space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        handleAddToCart();
      }}
    >
      {product.option_groups.map((g) => (
        <fieldset key={g.key} className="rounded-xl border border-zinc-200 bg-white p-5">
          <legend className="px-1 text-sm font-medium">
            {g.label}
            {g.required ? "" : " (optional)"}
            {g.selection === "multi" ? " — choose any" : ""}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.choices.map((c) => {
              const current = selections[g.key];
              const checked =
                g.selection === "multi"
                  ? Array.isArray(current) && current.includes(c.key)
                  : current === c.key;
              return (
                <label
                  key={c.key}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:border-zinc-500 ${
                    checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
                  }`}
                >
                  <input
                    type={g.selection === "multi" ? "checkbox" : "radio"}
                    name={g.key}
                    value={c.key}
                    checked={checked}
                    onChange={() =>
                      g.selection === "multi" ? toggleMulti(g.key, c.key) : setSingle(g.key, c.key)
                    }
                    className="sr-only"
                  />
                  {c.label}
                  {c.price_delta ? (
                    <span className={checked ? "text-xs text-zinc-300" : "text-xs text-zinc-400"}>
                      +${c.price_delta}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <label htmlFor="quantity" className="text-sm font-medium">
          Quantity
        </label>
        <input
          id="quantity"
          type="number"
          min={product.min_order_qty}
          step={1}
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(product.min_order_qty, Number(e.target.value) || product.min_order_qty))
          }
          className="w-24 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
        />
        {product.min_order_qty > 1 ? (
          <span className="text-xs text-zinc-500">MOQ {product.min_order_qty}</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <p className="text-sm text-zinc-500">
        Artwork upload happens from your cart — configure everything you need first.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Add to cart
        </button>
        {justAdded ? (
          <Link href="/cart" className="text-sm font-medium underline underline-offset-2">
            Added — view cart →
          </Link>
        ) : null}
      </div>
    </form>
  );
}
