"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = { names: string[]; initial: string; supplier: string; empty: boolean };

export function ProductSearch({ names, initial, supplier, empty }: Props) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase();
    if (!needle) return [];
    const starts = names.filter((n) => n.toLowerCase().startsWith(needle));
    const rest = names.filter((n) => !n.toLowerCase().startsWith(needle) && n.toLowerCase().includes(needle));
    return [...starts, ...rest].slice(0, 8);
  }, [names, value]);

  function go(q: string) {
    const params = new URLSearchParams();
    if (supplier) params.set("supplier", supplier);
    if (empty) params.set("empty", "1");
    if (q.trim()) params.set("q", q.trim());
    setOpen(false);
    router.push(`/admin/product-images${params.size ? `?${params}` : ""}`);
  }

  function pick(name: string) {
    setValue(name);
    go(name);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => Math.min(c + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && cursor >= 0 && matches[cursor]) pick(matches[cursor]);
      else go(value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && matches.length > 0;

  return (
    <div className="relative mt-4 max-w-xl">
      <input
        role="combobox"
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
        placeholder="Type in the product you would like to provide an image"
        autoComplete="off"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {matches.map((name, i) => (
            <li
              key={name}
              role="option"
              aria-selected={i === cursor}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(name);
              }}
              onMouseEnter={() => setCursor(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === cursor ? "bg-zinc-100" : ""}`}
            >
              {name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
