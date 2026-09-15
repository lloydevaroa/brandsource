import type { SubOrderStatus } from "@/lib/types";

export const STATUS_ORDER: SubOrderStatus[] = [
  "new_order",
  "payment_received",
  "artwork_required",
  "proof_awaiting_approval",
  "ready_to_order",
  "sent_to_supplier",
  "in_production",
  "dispatched",
  "completed",
];

export const STATUS_LABEL: Record<SubOrderStatus, string> = {
  new_order: "New order",
  payment_received: "Payment received",
  artwork_required: "Artwork required",
  proof_awaiting_approval: "Proof awaiting approval",
  ready_to_order: "Ready to order",
  sent_to_supplier: "Sent to supplier",
  in_production: "In production",
  dispatched: "Dispatched",
  completed: "Completed",
};
