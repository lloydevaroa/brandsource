import Link from "next/link";
import Image from "next/image";
import { createServiceSupabase } from "@/lib/supabase/server";
import { requireStaffProfile } from "../staff-guard";
import { HeroUploader } from "./HeroUploader";
import { deleteHeroSlide, moveHeroSlide, saveHeroSlide } from "./actions";

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
            <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative aspect-[21/9] w-full shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:w-64">
                  <Image src={s.image_url} alt="" fill sizes="256px" className="object-cover" />
                </div>
                <form action={saveHeroSlide} className="flex-1 space-y-3">
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    name="headline"
                    defaultValue={s.headline ?? ""}
                    placeholder="Headline (optional)"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      name="button_label"
                      defaultValue={s.button_label ?? ""}
                      placeholder="Button text (optional)"
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
                    />
                    <input
                      name="button_href"
                      defaultValue={s.button_href ?? ""}
                      placeholder="Button link, e.g. /category/lanyards"
                      className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input type="checkbox" name="active" defaultChecked={s.active} />
                      Show on site
                    </label>
                    <button
                      type="submit"
                      className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
              <div className="mt-3 flex gap-4 border-t border-zinc-100 pt-3 text-sm">
                <form action={moveHeroSlide}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button type="submit" disabled={i === 0} className="text-zinc-600 hover:text-zinc-900 disabled:opacity-30">
                    ↑ Move earlier
                  </button>
                </form>
                <form action={moveHeroSlide}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button
                    type="submit"
                    disabled={i === mine.length - 1}
                    className="text-zinc-600 hover:text-zinc-900 disabled:opacity-30"
                  >
                    ↓ Move later
                  </button>
                </form>
                <form action={deleteHeroSlide} className="ml-auto">
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="text-red-600 hover:text-red-800">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
