"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMenuCategories } from "@/lib/menu-categories";
import { matchesAll, searchRank, searchTokens } from "@/lib/search";

type Hit = { href: string; label: string; kind: "Product" | "Category" };

/** Header search: type-ahead over the menu's products and categories; Enter opens /search. */
export function SiteSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const categories = useMenuCategories();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const hits = useMemo<Hit[]>(() => {
    const tokens = searchTokens(value);
    if (tokens.length === 0) return [];
    const seen = new Set<string>();
    const found: (Hit & { rank: number })[] = [];
    for (const c of categories) {
      if (matchesAll(c.name, tokens)) {
        found.push({
          href: `/category/${c.slug}`,
          label: c.name,
          kind: "Category",
          rank: searchRank(c.name, tokens, value),
        });
      }
      for (const p of c.products) {
        if (seen.has(p.slug) || !matchesAll(p.name, tokens)) continue;
        seen.add(p.slug);
        found.push({
          href: `/products/${p.slug}`,
          label: p.name,
          kind: "Product",
          rank: searchRank(p.name, tokens, value),
        });
      }
    }
    return found.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label)).slice(0, 8);
  }, [categories, value]);

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function pick(hit: Hit) {
    setOpen(false);
    setValue("");
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && cursor >= 0 && hits[cursor]) pick(hits[cursor]);
      else submit(value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && hits.length > 0;

  return (
    <div role="search" className={`relative ${className}`}>
      <input
        type="search"
        role="combobox"
        aria-label="Search our range"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setCursor(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Search our range"
        autoComplete="off"
        className="w-full rounded-full border border-zinc-200 bg-zinc-100 py-2 pl-4 pr-10 text-sm text-brand-charcoal placeholder:text-zinc-500 focus:border-brand-charcoal focus:bg-white focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Search"
        onClick={() => submit(value)}
        className="absolute inset-y-0 right-1 flex w-9 items-center justify-center text-zinc-500 hover:text-zinc-900"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l4 4" />
        </svg>
      </button>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {hits.map((h, i) => (
            <li
              key={`${h.kind}-${h.href}`}
              role="option"
              aria-selected={i === cursor}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(h);
              }}
              onMouseEnter={() => setCursor(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${
                i === cursor ? "bg-zinc-100" : ""
              }`}
            >
              <span>{h.label}</span>
              <span className="text-xs uppercase tracking-wide text-zinc-400">{h.kind}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
