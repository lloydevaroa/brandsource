import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../staff-guard";
import { HeroUploader } from "./HeroUploader";
import { HeroSlideCard } from "./HeroSlideCard";

export default async function HeroAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const staffResult = await requireStaffProfile("Hero images");
  if ("guard" in staffResult) return staffResult.guard;

  const { page } = await searchParams;
  const supabase = createServiceSupabase();
  const [cats, slides] = await Promise.all([
    supabase
      .from("categories")
      .select("slug, name, parent_id")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("hero_slides")
      .select("id, page_key, image_url, headline, button_label, button_href, active")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  const error = cats.error ?? slides.error;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Hero images</h1>
        <p className="mt-2 text-red-600">Could not load: {error.message}</p>
        <p className="mt-2 text-sm text-zinc-600">
          If this says the table does not exist, run <code>supabase/hero-slides.sql</code> in the
          Supabase SQL editor first.
        </p>
      </div>
    );
  }

  const pages = [
    { key: "home", label: "Home page" },
    ...(cats.data ?? []).filter((c) => c.parent_id !== null).map((c) => ({ key: c.slug, label: c.name })),
  ];
  const current = pages.find((p) => p.key === page) ?? pages[0];
  const counts = new Map<string, number>();
  for (const s of slides.data ?? []) counts.set(s.page_key, (counts.get(s.page_key) ?? 0) + 1);
  const mine = (slides.data ?? []).filter((s) => s.page_key === current.key);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Team dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Hero images</h1>
        <p className="mt-2 text-sm text-zinc-500">
          The big image at the top of the home page and each category page. Add more than one and
          they slide automatically. A page with none shows no hero.
        </p>

        <ul className="mt-6 flex flex-wrap gap-2">
          {pages.map((p) => (
            <li key={p.key}>
              <Link
                href={`/admin/hero?page=${p.key}`}
                className={`inline-block rounded-full border px-3 py-1.5 text-sm ${
                  p.key === current.key
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
                }`}
              >
                {p.label}
                {counts.get(p.key) ? ` (${counts.get(p.key)})` : ""}
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="font-medium">Add images to: {current.label}</h2>
          <div className="mt-3">
            <HeroUploader pageKey={current.key} />
          </div>
        </section>

        <ul className="mt-6 space-y-4">
          {mine.length === 0 ? <li className="text-sm text-zinc-500">No images yet for this page.</li> : null}
          {mine.map((s, i) => (
            <HeroSlideCard key={s.id} slide={s} first={i === 0} last={i === mine.length - 1} />
          ))}
        </ul>
      </div>
    </div>
  );
}
