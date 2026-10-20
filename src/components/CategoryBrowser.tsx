"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Category, CategoryProduct } from "@/lib/categories";
import { factKey, groupOfKey, matchesSelection, type FilterGroup } from "@/lib/category-filters";
import { CategoryTile, ProductCard } from "@/components/CategoryViews";

/**
 * Everything under a category heading: the filter bar, then either the
 * sub-category tiles (nothing filtered, category has children) or the product
 * grid. Choosing a filter switches to the matching products. Selections live
 * in the URL (`?f=group~option`, repeated) so a filtered view can be shared.
 */
export function CategoryBrowser({
  tiles,
  products,
  groups,
  facts,
}: {
  tiles: Category[];
  products: CategoryProduct[];
  groups: FilterGroup[];
  facts: Record<string, string[]>;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const validKeys = useMemo(
    () => new Set(groups.flatMap((g) => g.options.map((o) => factKey(g.id, o.id)))),
    [groups],
  );

  // Pick up a shared filtered link once mounted (the server render is always unfiltered).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search)
      .getAll("f")
      .filter((k) => validKeys.has(k));
    if (fromUrl.length > 0) setSelected(fromUrl);
  }, [validKeys]);

  function commit(next: string[]) {
    setSelected(next);
    const params = new URLSearchParams(window.location.search);
    params.delete("f");
    for (const k of next) params.append("f", k);
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  const toggle = (key: string) =>
    commit(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const filtering = selected.length > 0;
  const matches = useMemo(
    () => products.filter((p) => matchesSelection(facts[p.slug], selected)),
    [products, facts, selected],
  );

  /** How many products an option would give, with every other group's choices applied. */
  function countFor(groupId: string, key: string): number {
    const others = selected.filter((k) => groupOfKey(k) !== groupId);
    return products.filter((p) => facts[p.slug]?.includes(key) && matchesSelection(facts[p.slug], others)).length;
  }

  const chips = selected.flatMap((key) => {
    const group = groups.find((g) => g.id === groupOfKey(key));
    const option = group?.options.find((o) => factKey(group.id, o.id) === key);
    return group && option ? [{ key, group: group.label, option: option.label }] : [];
  });

  const showProducts = filtering || tiles.length === 0;

  return (
    <>
      {groups.length > 0 ? (
        <div className="mt-6 border-y border-zinc-200 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
              className={`inline-flex items-center gap-2 rounded border px-4 py-2 text-sm font-bold uppercase tracking-wide ${
                open || filtering
                  ? "border-brand-charcoal bg-brand-charcoal text-white"
                  : "border-zinc-300 text-brand-charcoal hover:border-brand-charcoal"
              }`}
            >
              <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4h12M4.5 8h7M7 12h2" />
              </svg>
              Filter
              {filtering ? (
                <span className="rounded-full bg-brand-orange px-1.5 text-xs leading-5 text-white">{selected.length}</span>
              ) : null}
            </button>

            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                aria-label={`Remove filter ${c.group}: ${c.option}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
              >
                {c.option}
                <span aria-hidden className="text-zinc-400">&times;</span>
              </button>
            ))}
            {filtering ? (
              <button type="button" onClick={() => commit([])} className="text-sm font-medium text-brand-orange hover:underline">
                Clear all
              </button>
            ) : null}

            <p aria-live="polite" className="ml-auto text-sm text-zinc-500">
              {filtering
                ? `Showing ${matches.length} of ${products.length} products`
                : `${products.length} products`}
            </p>
          </div>

          {open ? (
            <div id={panelId} className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {groups.map((g) => {
                const long = g.options.length > 8; // a long list gets two columns instead of a tall panel
                return (
                <fieldset key={g.id} className={`min-w-0 ${long ? "sm:col-span-2" : ""}`}>
                  <legend className="w-full border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                    {g.label}
                  </legend>
                  <ul className={`mt-2 ${long ? "sm:columns-2 sm:gap-x-8" : ""}`}>
                    {g.options.map((o) => {
                      const key = factKey(g.id, o.id);
                      const checked = selected.includes(key);
                      const count = countFor(g.id, key);
                      const unavailable = count === 0 && !checked;
                      return (
                        <li key={o.id} className="break-inside-avoid">
                          <label
                            className={`flex items-start gap-2 py-1 text-sm ${
                              unavailable ? "cursor-not-allowed text-zinc-400" : "cursor-pointer text-zinc-700 hover:text-zinc-900"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={unavailable}
                              onChange={() => toggle(key)}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-orange"
                            />
                            <span className="min-w-0">
                              {o.label} <span className="text-zinc-400">({count})</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {showProducts ? (
        matches.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {matches.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </ul>
        ) : (
          <div className="mt-8 rounded-lg border border-zinc-200 bg-brand-grey p-8 text-center">
            <p className="font-medium">No products match those filters.</p>
            <button type="button" onClick={() => commit([])} className="mt-3 text-sm font-bold text-brand-orange hover:underline">
              Clear all filters
            </button>
          </div>
        )
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {tiles.map((c) => (
            <CategoryTile key={c.slug} category={c} />
          ))}
        </ul>
      )}
    </>
  );
}
