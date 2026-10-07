import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumb, CategoryTile, ProductCard } from "@/components/CategoryViews";
import { HeroSlider } from "@/components/HeroSlider";
import { getHeroSlides } from "@/lib/hero";
import { getCategories, getChildren } from "@/lib/categories";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  return { title: category ? `${category.name} | BRANDSource` : "BRANDSource" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await getCategories();
  const category = all.find((c) => c.slug === slug);
  if (!category) notFound();

  const parent = all.find((c) => c.slug === category.parent_slug);
  const children = getChildren(all, category.slug);
  const siblings = parent ? getChildren(all, parent.slug).filter((c) => c.slug !== category.slug) : [];

  const slides = await getHeroSlides(slug);

  const trail = [
    { label: "Home", href: "/" },
    ...(parent ? [{ label: parent.name, href: `/category/${parent.slug}` }] : []),
    { label: category.name },
  ];

  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />
      <HeroSlider slides={slides} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Breadcrumb trail={trail} />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{category.name}</h1>

        {children.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => (
              <CategoryTile key={c.slug} category={c} />
            ))}
          </ul>
        ) : category.products.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.products.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </ul>
        ) : null}

        {siblings.length > 0 ? (
          <section className="mt-14 border-t border-zinc-200 pt-8">
            <h2 className="text-sm font-medium text-zinc-500">More in {parent?.name}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {siblings.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/category/${s.slug}`}
                    className="inline-block rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
