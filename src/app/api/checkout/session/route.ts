import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { getStripe } from "@/lib/stripe";
import { catalog } from "@/data/catalog";

export const runtime = "nodejs";

type SubmittedItem = {
  productSlug: string;
  configuration: Record<string, string | string[]>;
  quantity: number;
  artwork: { path: string; filename: string }[];
};

function priceForItem(productSlug: string, configuration: Record<string, string | string[]>) {
  const product = catalog.find((p) => p.slug === productSlug);
  if (!product) return null;
  const base = product.unit_price ?? 0;
  const delta = product.option_groups.reduce((sum, g) => {
    const selected = configuration[g.key];
    if (!selected) return sum;
    const keys = Array.isArray(selected) ? selected : [selected];
    return (
      sum +
      keys.reduce((s, k) => s + (g.choices.find((c) => c.key === k)?.price_delta ?? 0), 0)
    );
  }, 0);
  return base + delta;
}

function configurationSummary(productSlug: string, configuration: Record<string, string | string[]>) {
  const product = catalog.find((p) => p.slug === productSlug);
  if (!product) return "";
  return product.option_groups
    .flatMap((g) => {
      const selected = configuration[g.key];
      if (!selected || (Array.isArray(selected) && selected.length === 0)) return [];
      const keys = Array.isArray(selected) ? selected : [selected];
      const labels = keys
        .map((k) => g.choices.find((c) => c.key === k)?.label)
        .filter(Boolean)
        .join(", ");
      return labels ? [`${g.label}: ${labels}`] : [];
    })
    .join(" · ");
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to check out." }, { status: 401 });
  }

  let body: { items?: SubmittedItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }
  for (const item of items) {
    if (
      typeof item.productSlug !== "string" ||
      typeof item.quantity !== "number" ||
      item.quantity < 1 ||
      typeof item.configuration !== "object"
    ) {
      return NextResponse.json({ error: "Malformed cart item" }, { status: 400 });
    }
  }
  for (const item of items) {
    const product = catalog.find((p) => p.slug === item.productSlug);
    if (product && item.quantity < product.min_order_qty) {
      return NextResponse.json(
        { error: `${product.name} has a minimum order quantity of ${product.min_order_qty}.` },
        { status: 400 }
      );
    }
  }

  const profile = await syncCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Could not resolve your account." }, { status: 500 });
  }

  const supabase = createServiceSupabase();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, slug")
    .in(
      "slug",
      items.map((i) => i.productSlug)
    );
  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }
  const productIdBySlug = new Map(products.map((p) => [p.slug, p.id as string]));
  for (const item of items) {
    if (!productIdBySlug.has(item.productSlug)) {
      return NextResponse.json(
        { error: `Unknown product: ${item.productSlug}` },
        { status: 400 }
      );
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ customer_id: profile.id, status: "draft" })
    .select("id")
    .single();
  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  const lineItems: {
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string; description?: string };
    };
    quantity: number;
  }[] = [];

  for (const item of items) {
    const unitPrice = priceForItem(item.productSlug, item.configuration);
    if (unitPrice === null || unitPrice <= 0) {
      return NextResponse.json(
        { error: `No price available for ${item.productSlug}` },
        { status: 400 }
      );
    }
    const { data: line, error: lineError } = await supabase
      .from("order_lines")
      .insert({
        order_id: order.id,
        product_id: productIdBySlug.get(item.productSlug),
        quantity: item.quantity,
        unit_price: unitPrice,
        configuration: item.configuration,
      })
      .select("id")
      .single();
    if (lineError) {
      return NextResponse.json({ error: lineError.message }, { status: 500 });
    }

    if (item.artwork.length > 0) {
      const { error: artworkError } = await supabase.from("artwork_files").insert(
        item.artwork.map((a) => ({
          order_line_id: line.id,
          storage_path: a.path,
          uploaded_by: profile.id,
        }))
      );
      if (artworkError) {
        return NextResponse.json({ error: artworkError.message }, { status: 500 });
      }
    }

    const product = catalog.find((p) => p.slug === item.productSlug)!;
    const summary = configurationSummary(item.productSlug, item.configuration);
    lineItems.push({
      price_data: {
        currency: "nzd",
        unit_amount: Math.round(unitPrice * 100),
        product_data: {
          name: product.name,
          ...(summary ? { description: summary } : {}),
        },
      },
      quantity: item.quantity,
    });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  let session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: profile.email ?? undefined,
      success_url: `${origin}/account?paid=${order.id}`,
      cancel_url: `${origin}/cart?canceled=${order.id}`,
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id } },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not start checkout." },
      { status: 500 }
    );
  }

  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
