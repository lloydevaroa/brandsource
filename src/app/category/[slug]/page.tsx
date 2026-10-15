import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Breadcrumb } from "@/components/CategoryViews";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { HeroSlider } from "@/components/HeroSlider";
import { getHeroSlides } from "@/lib/hero";
import { getCategories, getChildren, getProductSpecs, type CategoryProduct } from "@/lib/categories";
import { buildFilterModel } from "@/lib/category-filters";

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

  // What the filter menu works over: this category's products, or with sub-categories, all of theirs.
  const scope = children.length > 0 ? children : [category];
  const productsBySlug = new Map<string, CategoryProduct>();
  const categoriesOf = new Map<string, string[]>();
  for (const c of scope) {
    for (const p of c.products) {
      if (!productsBySlug.has(p.slug)) productsBySlug.set(p.slug, p);
      categoriesOf.set(p.slug, [...(categoriesOf.get(p.slug) ?? []), c.slug]);
    }
  }
  const products = [...productsBySlug.values()];
  const specs = await getProductSpecs(scope.map((c) => c.slug));
  const model = buildFilterModel(
    products.map((p) => ({
      slug: p.slug,
      unit_price: p.unit_price,
      categories: children.length > 0 ? (categoriesOf.get(p.slug) ?? []) : [],
      specs: specs.get(p.slug) ?? [],
    })),
    children.map((c) => ({ slug: c.slug, name: c.name })),
  );

  const trail = [
    { label: "Home", href: "/" },
    ...(parent ? [{ label: parent.name, href: `/category/${parent.slug}` }] : []),
    { label: category.name },
  ];

  return (
    <div className="min-h-screen bg-white text-brand-charcoal">
      <SiteHeader />
      <HeroSlider slides={slides} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Breadcrumb trail={trail} />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{category.name}</h1>

        <CategoryBrowser
          tiles={children.map((c) => ({ ...c, products: [] }))}
          products={products}
          groups={model.groups}
          facts={model.facts}
        />

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
