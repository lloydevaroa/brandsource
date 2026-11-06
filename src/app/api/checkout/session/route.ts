import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
import { getStripe } from "@/lib/stripe";
import { randomUUID } from "node:crypto";
import { getCatalogForSlugs } from "@/lib/catalog";
import { priceForItem, configurationSummary } from "@/lib/pricing";
import { getViewerTier, isMissingTierSchema } from "@/lib/rate-tiers";

export const runtime = "nodejs";

type SubmittedItem = {
  productSlug: string;
  configuration: Record<string, string | string[]>;
  quantity: number;
  artwork: { path: string; filename: string }[];
};

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
  const profile = await syncCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Could not resolve your account." }, { status: 500 });
  }

  const supabase = createServiceSupabase();
  const slugs = items.map((i) => i.productSlug);

  // Independent reads run together: only the cart's own products are loaded, not the whole catalogue.
  const [catalog, productsResult, tier] = await Promise.all([
    getCatalogForSlugs(slugs),
    supabase.from("products").select("id, slug").in("slug", slugs),
    // The signed-in customer's rate tier (from their linked client), else Retail.
    getViewerTier(profile),
  ]);

  for (const item of items) {
    const product = catalog.find((p) => p.slug === item.productSlug);
    if (product && item.quantity < product.min_order_qty) {
      return NextResponse.json(
        { error: `${product.name} has a minimum order quantity of ${product.min_order_qty}.` },
        { status: 400 }
      );
    }
  }

  if (productsResult.error) {
    return NextResponse.json({ error: productsResult.error.message }, { status: 500 });
  }
  const productIdBySlug = new Map(productsResult.data.map((p) => [p.slug, p.id as string]));
  for (const item of items) {
    if (!productIdBySlug.has(item.productSlug)) {
      return NextResponse.json(
        { error: `Unknown product: ${item.productSlug}` },
        { status: 400 }
      );
    }
  }

  const discount = tier?.discount_percent ?? 0;

  // Price every line before writing anything, so a bad line never leaves a half-made order.
  const priced = [];
  for (const item of items) {
    const unitPrice = priceForItem(catalog, item.productSlug, item.configuration, discount);
    const listPrice = priceForItem(catalog, item.productSlug, item.configuration);
    if (unitPrice === null || unitPrice <= 0) {
      return NextResponse.json(
        { error: `No price available for ${item.productSlug}` },
        { status: 400 }
      );
    }
    priced.push({ item, unitPrice, listPrice, lineId: randomUUID() });
  }

  const orderRow: Record<string, unknown> = { customer_id: profile.id, status: "draft", payment_method: "card" };
  let { data: order, error: orderError } = await supabase
    .from("orders")
    .insert(tier ? { ...orderRow, rate_tier_id: tier.id } : orderRow)
    .select("id")
    .single();
  if (orderError && isMissingTierSchema(orderError.message) && !tier) {
    ({ data: order, error: orderError } = await supabase.from("orders").insert(orderRow).select("id").single());
  }
  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message ?? "Could not create the order." }, { status: 500 });
  }

  // All lines in one write (ids made here so artwork can be attached in a second single write).
  const { error: linesError } = await supabase.from("order_lines").insert(
    priced.map((p) => ({
      id: p.lineId,
      order_id: order.id,
      product_id: productIdBySlug.get(p.item.productSlug),
      quantity: p.item.quantity,
      unit_price: p.unitPrice,
      ...(tier ? { list_price: p.listPrice } : {}),
      configuration: p.item.configuration,
    }))
  );
  if (linesError) {
    return NextResponse.json({ error: linesError.message }, { status: 500 });
  }

  const artworkRows = priced.flatMap((p) =>
    p.item.artwork.map((a) => ({ order_line_id: p.lineId, storage_path: a.path, uploaded_by: profile.id }))
  );
  if (artworkRows.length > 0) {
    const { error: artworkError } = await supabase.from("artwork_files").insert(artworkRows);
    if (artworkError) {
      return NextResponse.json({ error: artworkError.message }, { status: 500 });
    }
  }

  const lineItems = priced.map((p) => {
    const product = catalog.find((c) => c.slug === p.item.productSlug)!;
    const summary = configurationSummary(catalog, p.item.productSlug, p.item.configuration);
    return {
      price_data: {
        currency: "nzd",
        unit_amount: Math.round(p.unitPrice * 100),
        product_data: {
          name: product.name,
          ...(summary ? { description: summary } : {}),
        },
      },
      quantity: p.item.quantity,
    };
  });

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  let session;
  try {
    const stripe = getStripe();
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: profile.email ?? undefined,
      success_url: `${origin}/order-confirmed?order=${order.id}`,
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
