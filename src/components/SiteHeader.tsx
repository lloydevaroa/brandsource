"use client";

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

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-wide">
          BRANDSource
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600">
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
      </div>
    </header>
  );
}
