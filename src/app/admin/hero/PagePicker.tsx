"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PageOption = { key: string; label: string; group: string | null; count: number };

/** Search box for the category pages, so staff type a few letters instead of scanning a wall of buttons. */
export function PagePicker({ options }: { options: PageOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = (q
    ? options.filter((o) => `${o.label} ${o.group ?? ""}`.toLowerCase().includes(q))
    : options
  ).slice(0, 12);

  function pick(key: string) {
    setOpen(false);
    setQuery("");
    router.push(`/admin/hero?page=${encodeURIComponent(key)}`);
  }

  return (
    <div className="relative">
      <label htmlFor="hero-page-search" className="block text-sm font-medium text-zinc-900">
        Category page
      </label>
      <input
        id="hero-page-search"
        type="search"
        autoComplete="off"
        placeholder="Type to find a category, e.g. banners"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            pick(matches[0].key);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
      />
      {open ? (
        <ul className="absolute z-10 mt-1 max-h-72 w-full max-w-md overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500">No category matches.</li>
          ) : null}
          {matches.map((o) => (
            <li key={o.key}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.key)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-100"
              >
                <span>
                  {o.label}
                  {o.group ? <span className="text-zinc-400"> · {o.group}</span> : null}
                </span>
                {o.count ? <span className="text-xs text-zinc-500">{o.count} image{o.count === 1 ? "" : "s"}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
