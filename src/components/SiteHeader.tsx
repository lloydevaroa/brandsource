"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { useCart } from "@/lib/cart";
import { useMenuCategories } from "@/lib/menu-categories";

export function SiteHeader() {
  const { items } = useCart();
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const categories = useMenuCategories();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" aria-label="BRANDSource home">
          <Image
            src="/brand/BrandSource-Primary.svg"
            alt="BRANDSource"
            width={822}
            height={74}
            className="h-6 w-auto"
            unoptimized
            priority
          />
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-zinc-600 sm:flex">
          <span className="text-zinc-400">NZ suppliers</span>
          <Link href="/cart" className="hover:text-zinc-900">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </Link>
          <SignedOut>
            <SignInButton mode="modal">
              <button type="button" className="hover:text-zinc-900">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="px-3 py-1.5 text-xs bg-brand-orange text-white font-bold uppercase tracking-wide hover:bg-[#e64300]"
              >
                Create account
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/account" className="hover:text-zinc-900">
              Account
            </Link>
            <Link href="/admin" className="hover:text-zinc-900">
              Staff
            </Link>
            <UserButton />
          </SignedIn>
        </nav>

        <div className="flex items-center gap-3 sm:hidden">
          <Link href="/cart" className="text-sm text-zinc-600 hover:text-zinc-900">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </Link>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" />
              ) : (
                <path d="M3 5h14M3 10h14M3 15h14" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {categories.length > 0 ? (
        <nav
          aria-label="Product categories"
          className="hidden border-t border-zinc-200 sm:block"
        >
          <ul className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 px-6 text-sm text-zinc-700">
            {categories.map((c) => (
              <li key={c.slug} className="group relative">
                <Link
                  href={`/category/${c.slug}`}
                  className="block px-3 py-2.5 hover:text-zinc-900"
                >
                  {c.name}
                </Link>
                {c.products.length > 0 ? (
                  <ul className="invisible absolute left-0 top-full z-20 min-w-56 rounded-md border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {c.products.map((k) => (
                      <li key={k.slug}>
                        <Link
                          href={`/products/${k.slug}`}
                          className="block px-4 py-1.5 hover:bg-zinc-50 hover:text-zinc-900"
                        >
                          {k.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {menuOpen ? (
        <nav className="border-t border-zinc-200 bg-white px-6 py-4 text-sm text-zinc-600 sm:hidden">
          <div className="flex flex-col gap-3">
            {categories.map((c) => (
              <div key={c.slug}>
                <div className="flex items-center justify-between">
                  <Link
                    href={`/category/${c.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="hover:text-zinc-900"
                  >
                    {c.name}
                  </Link>
                  {c.products.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={openGroup === c.slug}
                      aria-label={`Show ${c.name} products`}
                      onClick={() => setOpenGroup(openGroup === c.slug ? null : c.slug)}
                      className="p-2 text-zinc-500 hover:text-zinc-900"
                    >
                      <span aria-hidden>{openGroup === c.slug ? "−" : "+"}</span>
                    </button>
                  ) : null}
                </div>
                {openGroup === c.slug ? (
                  <div className="mt-1 flex flex-col gap-2 border-l border-zinc-200 pl-3">
                    {c.products.map((k) => (
                      <Link
                        key={k.slug}
                        href={`/products/${k.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="hover:text-zinc-900"
                      >
                        {k.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <span className="text-zinc-400">NZ suppliers</span>
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="text-left hover:text-zinc-900">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="w-fit px-3 py-1.5 text-xs bg-brand-orange text-white font-bold uppercase tracking-wide hover:bg-[#e64300]"
                >
                  Create account
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className="hover:text-zinc-900"
              >
                Account
              </Link>
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="hover:text-zinc-900"
              >
                Staff
              </Link>
            </SignedIn>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
