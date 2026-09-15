"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { useCart } from "@/lib/cart";

export function SiteHeader() {
  const { items } = useCart();
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-wide">
          BRANDSource
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-zinc-600 sm:flex">
          <Link href="/#products" className="hover:text-zinc-900">
            Trade Show products
          </Link>
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
                className="rounded-full bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800"
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

      {menuOpen ? (
        <nav className="border-t border-zinc-200 bg-white px-6 py-4 text-sm text-zinc-600 sm:hidden">
          <div className="flex flex-col gap-3">
            <Link
              href="/#products"
              onClick={() => setMenuOpen(false)}
              className="hover:text-zinc-900"
            >
              Trade Show products
            </Link>
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
                  className="w-fit rounded-full bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800"
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
