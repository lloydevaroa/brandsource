"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Shown when a page fails to load, most often because the product database did
 * not answer in time. Keeps the site header so visitors can still navigate.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">Temporary problem</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">We can&apos;t load this page right now</h1>
        <p className="mt-4 text-zinc-600">
          Our product catalogue isn&apos;t responding at the moment. Nothing you&apos;ve added to your cart has been
          lost. Please try again in a minute, or contact us if it keeps happening.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded border border-zinc-300 px-5 py-2.5 text-sm font-semibold hover:bg-brand-grey"
          >
            Back to home
          </Link>
        </div>
        {error.digest && <p className="mt-10 text-xs text-zinc-400">Reference: {error.digest}</p>}
      </main>
    </div>
  );
}
