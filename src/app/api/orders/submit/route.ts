import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceSupabase } from "@/lib/supabase/server";
import { syncCurrentProfile } from "@/lib/supabase/profile";
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

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to submit a quote request." }, { status: 401 });
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
    .insert({ customer_id: profile.id, status: "submitted" })
    .select("id")
    .single();
  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  for (const item of items) {
    const unitPrice = priceForItem(item.productSlug, item.configuration) ?? 0;
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

    const { error: subOrderError } = await supabase.from("sub_orders").insert({
      order_id: order.id,
      order_line_id: line.id,
      status: "new_order",
    });
    if (subOrderError) {
      return NextResponse.json({ error: subOrderError.message }, { status: 500 });
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
  }

  return NextResponse.json({ orderId: order.id });
}
