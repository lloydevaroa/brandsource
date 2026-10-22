"use client";

import { useMemo, useState } from "react";
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
import { groupProductsAz, useMenuCategories } from "@/lib/menu-categories";
import { CategoryBar } from "@/components/CategoryBar";
import { SiteSearch } from "@/components/SiteSearch";

const ALL_PRODUCTS = "__all-products";

function UserIcon() {
  return (
    <svg
      aria-hidden
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}

function CartLink({ itemCount, label }: { itemCount: number; label: string }) {
  return (
    <Link href="/cart" aria-label={label} className="relative p-1 hover:text-brand-orange">
      <svg
        aria-hidden
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h3l2.5 12.5h11L21 7H6" />
        <circle cx="9.5" cy="19.5" r="1.4" />
        <circle cx="17" cy="19.5" r="1.4" />
      </svg>
      <span
        aria-hidden
        className="absolute -right-1.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-orange px-1 text-[11px] font-bold leading-none text-white"
      >
        {itemCount}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { items } = useCart();
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const categories = useMenuCategories();
  const allProducts = useMemo(() => groupProductsAz(categories), [categories]);

  const cartLabel = `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`;

  return (
    <header className="bg-brand-charcoal text-white">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="BRANDSource home" className="shrink-0">
          <Image
            src="/brand/BrandSource-Reversed.svg"
            alt="BRANDSource"
            width={822}
            height={74}
            className="h-5 w-auto sm:h-8"
            unoptimized
            priority
          />
        </Link>

        <SiteSearch className="mx-6 hidden max-w-xl flex-1 sm:block" />

        <nav className="hidden items-center gap-7 text-[13px] font-semibold sm:flex">
          <span className="font-medium text-white/70">NZ support</span>
          <SignedOut>
            <SignInButton mode="modal">
              <button type="button" className="flex items-center gap-2 hover:text-brand-orange">
                <UserIcon />
                Account
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/account" className="flex items-center gap-2 hover:text-brand-orange">
              <UserIcon />
              Account
            </Link>
            <Link href="/admin" className="hover:text-brand-orange">
              Staff
            </Link>
            <UserButton />
          </SignedIn>
          <CartLink itemCount={itemCount} label={cartLabel} />
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <CartLink itemCount={itemCount} label={cartLabel} />
          <SignedIn>
            <UserButton />
          </SignedIn>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            className="rounded-md p-2 text-white hover:bg-white/10"
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

      <div className="px-4 pb-3 sm:hidden">
        <SiteSearch />
      </div>

      <CategoryBar />

      {menuOpen ? (
        <nav className="border-t border-white/10 bg-brand-charcoal-soft px-6 py-4 text-sm text-white/80 sm:hidden">
          <div className="flex flex-col gap-3">
            {allProducts.length > 0 ? (
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">All products</span>
                  <button
                    type="button"
                    aria-expanded={openGroup === ALL_PRODUCTS}
                    aria-label="Show all products A to Z"
                    onClick={() => setOpenGroup(openGroup === ALL_PRODUCTS ? null : ALL_PRODUCTS)}
                    className="p-2 text-white/60 hover:text-white"
                  >
                    <span aria-hidden>{openGroup === ALL_PRODUCTS ? "−" : "+"}</span>
                  </button>
                </div>
                {openGroup === ALL_PRODUCTS ? (
                  <div className="mt-1 flex max-h-96 flex-col gap-3 overflow-y-auto border-l border-white/20 pl-3">
                    {allProducts.map((g) => (
                      <div key={g.letter} className="flex flex-col gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-brand-orange">
                          {g.letter}
                        </span>
                        {g.products.map((k) => (
                          <Link
                            key={k.slug}
                            href={`/products/${k.slug}`}
                            onClick={() => setMenuOpen(false)}
                            className="hover:text-white"
                          >
                            {k.name}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {categories.map((c) => (
              <div key={c.slug}>
                <div className="flex items-center justify-between">
                  <Link
                    href={`/category/${c.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="hover:text-white"
                  >
                    {c.name}
                  </Link>
                  {c.products.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={openGroup === c.slug}
                      aria-label={`Show ${c.name} products`}
                      onClick={() => setOpenGroup(openGroup === c.slug ? null : c.slug)}
                      className="p-2 text-white/60 hover:text-white"
                    >
                      <span aria-hidden>{openGroup === c.slug ? "−" : "+"}</span>
                    </button>
                  ) : null}
                </div>
                {openGroup === c.slug ? (
                  <div className="mt-1 flex flex-col gap-2 border-l border-white/20 pl-3">
                    {c.products.map((k) => (
                      <Link
                        key={k.slug}
                        href={`/products/${k.slug}`}
                        onClick={() => setMenuOpen(false)}
                        className="hover:text-white"
                      >
                        {k.name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <span className="font-medium text-white/60">NZ support</span>
            <SignedOut>
              <SignInButton mode="modal">
                <button type="button" className="text-left hover:text-white">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="w-fit px-3 py-1.5 text-xs rounded bg-brand-orange text-white font-bold uppercase tracking-wide hover:bg-[#e64300]"
                >
                  Create account
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className="hover:text-white"
              >
                Account
              </Link>
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="hover:text-white"
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
