import type { ProductDetails } from "@/lib/catalog";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <div className="mt-2 text-sm text-zinc-700">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function ProductDetailsSections({ d }: { d: ProductDetails }) {
  const c = d.carton;
  return (
    <div className="mt-10 border-t border-zinc-200 pb-10">
      {d.features.length ? (
        <Section title="Features">
          <List items={d.features} />
        </Section>
      ) : null}

      {d.specifications.length ? (
        <Section title="Specifications">
          <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {d.specifications.map((s) => (
              <div key={s.name} className="grid grid-cols-2 gap-4 px-4 py-2">
                <dt className="text-zinc-500">{s.name}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {d.dimensions.length ? (
        <Section title="Dimensions">
          <List items={d.dimensions} />
        </Section>
      ) : null}

      {d.materials.length ? (
        <Section title="Materials">
          <List items={d.materials.map((m) => `${m.component}: ${m.material}`)} />
        </Section>
      ) : null}

      {d.branding_options.length || d.template_url ? (
        <Section title="Branding">
          {d.branding_options.map((b) => (
            <div key={b.type} className="mb-3">
              <p className="font-medium text-zinc-900">{b.type}</p>
              <List items={b.areas} />
            </div>
          ))}
          {d.template_url ? (
            <a
              href={d.template_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 underline"
            >
              Download artwork template (PDF)
            </a>
          ) : null}
        </Section>
      ) : null}

      {d.packaging || c ? (
        <Section title="Packaging">
          {d.packaging ? <p>{d.packaging}</p> : null}
          {c ? (
            <p className="mt-2">
              Carton: {c.length_cm} x {c.width_cm} x {c.height_cm} cm · {c.quantity} pieces · {c.weight_kg} kg
            </p>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
