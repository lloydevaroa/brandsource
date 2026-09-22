import { createServiceSupabase } from "@/lib/supabase/server";
import { configurationSummary } from "@/lib/pricing";
import type { OrderPaymentMethod, OrderStatus } from "@/lib/types";

export const REPORTS = {
  transactions: "Transactions (one row per line item)",
  customer: "By customer",
  item: "By item",
  price: "By price point",
} as const;

export type ReportKey = keyof typeof REPORTS;

export function isReportKey(value: string | null): value is ReportKey {
  return value !== null && value in REPORTS;
}

type Line = {
  orderId: string;
  orderDate: string;
  customerKey: string;
  customerName: string;
  customerType: string;
  paymentMethod: OrderPaymentMethod;
  poNumber: string | null;
  orderStatus: OrderStatus;
  productName: string;
  options: string;
  quantity: number;
  unitPrice: number;
};

/** YYYY-MM-DD in NZ time, so late-evening orders land on the right day. */
function nzDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

/**
 * Every line item on a real order (drafts are unpaid/abandoned carts, so
 * excluded — same rule as the order overview and Kanban).
 */
async function loadLines(): Promise<Line[]> {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      status,
      payment_method,
      po_number,
      created_at,
      customer:profiles!orders_customer_id_fkey ( id, full_name, email ),
      client:clients ( id, name, client_type ),
      order_lines ( quantity, unit_price, configuration, product:products ( slug, name ) )
    `
    )
    .neq("status", "draft")
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Same to-one embed cardinality caveat as admin/page.tsx.
  type Row = {
    id: string;
    status: OrderStatus;
    payment_method: OrderPaymentMethod;
    po_number: string | null;
    created_at: string;
    customer: { id: string; full_name: string | null; email: string | null } | null;
    client: { id: string; name: string; client_type: "managed" | "direct" } | null;
    order_lines: {
      quantity: number;
      unit_price: number;
      configuration: Record<string, string | string[]> | null;
      product: { slug: string; name: string } | null;
    }[];
  };

  return ((data ?? []) as unknown as Row[]).flatMap((order) =>
    order.order_lines.map((line) => ({
      orderId: order.id,
      orderDate: nzDate(order.created_at),
      customerKey: order.client?.id ?? order.customer?.id ?? "unknown",
      customerName:
        order.client?.name ?? order.customer?.full_name ?? order.customer?.email ?? "Unknown",
      customerType: order.client
        ? order.client.client_type === "managed"
          ? "Managed client"
          : "Direct client"
        : "Direct consumer",
      paymentMethod: order.payment_method,
      poNumber: order.po_number,
      orderStatus: order.status,
      productName: line.product?.name ?? "Unknown product",
      options: line.product ? configurationSummary(line.product.slug, line.configuration ?? {}) : "",
      quantity: line.quantity,
      unitPrice: Number(line.unit_price),
    }))
  );
}

const money = (n: number) => n.toFixed(2);

function cell(value: string | number) {
  if (typeof value === "number") return String(value);
  // Customer-entered text could start with a spreadsheet formula character.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(header: string[], rows: (string | number)[][]) {
  // BOM so Excel opens it as UTF-8 (names with macrons etc.).
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.values()];
}

const lineTotal = (l: Line) => l.quantity * l.unitPrice;
const sum = (lines: Line[], f: (l: Line) => number) => lines.reduce((s, l) => s + f(l), 0);
const orderCount = (lines: Line[]) => new Set(lines.map((l) => l.orderId)).size;

export async function buildReport(report: ReportKey): Promise<string> {
  const lines = await loadLines();

  switch (report) {
    case "transactions":
      return toCsv(
        [
          "Order date",
          "Order ref",
          "Client / customer",
          "Customer type",
          "Payment",
          "PO number",
          "Order status",
          "Product",
          "Options",
          "Quantity",
          "Unit price (NZD)",
          "Line total (NZD)",
        ],
        lines.map((l) => [
          l.orderDate,
          l.orderId.slice(0, 8),
          l.customerName,
          l.customerType,
          l.paymentMethod === "po" ? "PO" : "Card",
          l.poNumber ?? "",
          l.orderStatus,
          l.productName,
          l.options,
          l.quantity,
          money(l.unitPrice),
          money(lineTotal(l)),
        ])
      );

    case "customer":
      return toCsv(
        ["Client / customer", "Customer type", "Orders", "Units", "Total (NZD)", "First order", "Last order"],
        groupBy(lines, (l) => l.customerKey)
          .map((g) => ({ g, total: sum(g, lineTotal) }))
          .sort((a, b) => b.total - a.total)
          .map(({ g, total }) => [
            g[0].customerName,
            g[0].customerType,
            orderCount(g),
            sum(g, (l) => l.quantity),
            money(total),
            g[0].orderDate,
            g[g.length - 1].orderDate,
          ])
      );

    case "item":
      return toCsv(
        ["Product", "Orders", "Units", "Total (NZD)", "Average unit price (NZD)"],
        groupBy(lines, (l) => l.productName)
          .map((g) => ({ g, total: sum(g, lineTotal), units: sum(g, (l) => l.quantity) }))
          .sort((a, b) => b.total - a.total)
          .map(({ g, total, units }) => [
            g[0].productName,
            orderCount(g),
            units,
            money(total),
            money(units ? total / units : 0),
          ])
      );

    case "price":
      // One row per product at each unit price it has sold for, so price
      // changes and option-driven price differences show up separately.
      return toCsv(
        ["Product", "Unit price (NZD)", "Orders", "Units", "Total (NZD)"],
        groupBy(lines, (l) => `${l.productName}|${money(l.unitPrice)}`)
          .sort(
            (a, b) =>
              a[0].productName.localeCompare(b[0].productName) || a[0].unitPrice - b[0].unitPrice
          )
          .map((g) => [
            g[0].productName,
            money(g[0].unitPrice),
            orderCount(g),
            sum(g, (l) => l.quantity),
            money(sum(g, lineTotal)),
          ])
      );
  }
}
