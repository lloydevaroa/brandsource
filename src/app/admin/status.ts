import type { SubOrderStatus } from "@/lib/types";

/**
 * The board has three columns. The older detail (payment, artwork, proof,
 * supplier, dispatch) is a tick-list on each card, stored in
 * `sub_orders.checklist`. The database enum keeps its original nine values so
 * nothing needs rebuilding: only new_order, in_production (shown as
 * "Processing") and completed are written now.
 */
export type BoardColumn = "new_order" | "processing" | "completed";

export const COLUMN_ORDER: BoardColumn[] = ["new_order", "processing", "completed"];

export const COLUMN_LABEL: Record<BoardColumn, string> = {
  new_order: "New order",
  processing: "Processing",
  completed: "Completed",
};

/** The stored status each column writes. */
export const COLUMN_STATUS: Record<BoardColumn, SubOrderStatus> = {
  new_order: "new_order",
  processing: "in_production",
  completed: "completed",
};

export function boardColumn(status: SubOrderStatus | string): BoardColumn {
  if (status === "new_order") return "new_order";
  if (status === "completed") return "completed";
  return "processing";
}

export const CHECKLIST_ITEMS = [
  { key: "payment_received", label: "Payment received" },
  { key: "artwork_received", label: "Artwork received" },
  { key: "proof_approved", label: "Proof approved" },
  { key: "ordered_from_supplier", label: "Ordered from supplier" },
  { key: "in_production", label: "In production" },
  { key: "dispatched", label: "Dispatched" },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];
export type Checklist = Partial<Record<ChecklistKey, boolean>>;

const CHECKLIST_KEYS = new Set<string>(CHECKLIST_ITEMS.map((i) => i.key));

/** Ticks implied by the old nine-stage statuses, for rows saved before the checklist existed. */
const LEGACY_TICKS: Record<string, ChecklistKey[]> = {
  payment_received: ["payment_received"],
  artwork_required: ["payment_received"],
  proof_awaiting_approval: ["payment_received", "artwork_received"],
  ready_to_order: ["payment_received", "artwork_received", "proof_approved"],
  sent_to_supplier: ["payment_received", "artwork_received", "proof_approved", "ordered_from_supplier"],
  dispatched: ["payment_received", "artwork_received", "proof_approved", "ordered_from_supplier", "in_production", "dispatched"],
};

/** Stored ticks plus anything an old-style status implies. Safe on null/odd JSON. */
export function effectiveChecklist(status: string, stored: unknown): Checklist {
  const out: Checklist = {};
  for (const key of LEGACY_TICKS[status] ?? []) out[key] = true;
  if (stored && typeof stored === "object") {
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      if (CHECKLIST_KEYS.has(k) && typeof v === "boolean") out[k as ChecklistKey] = v;
    }
  }
  return out;
}

export function checklistProgress(checklist: Checklist) {
  const done = CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
  return { done, total: CHECKLIST_ITEMS.length };
}

export type ItemStateTone = "blocked" | "progress" | "done";

/**
 * One-line "where is this item" label for the order card, worked out from the
 * ticks. "blocked" means the team (or the client) has something to do before
 * the item can move; "progress" means it is moving; "done" is dispatched or
 * completed. Nothing is stored, so it always matches the tick-list.
 */
export function itemState(
  status: string,
  checklist: Checklist,
  artworkCount: number
): { label: string; tone: ItemStateTone } {
  if (status === "completed") return { label: "Completed", tone: "done" };
  if (checklist.dispatched) return { label: "Dispatched", tone: "done" };
  if (checklist.in_production) return { label: "In production", tone: "progress" };
  if (checklist.ordered_from_supplier) return { label: "Ordered from supplier", tone: "progress" };
  if (!checklist.payment_received) return { label: "Needs payment", tone: "blocked" };
  if (!checklist.artwork_received) {
    return { label: artworkCount > 0 ? "Artwork to confirm" : "Needs artwork", tone: "blocked" };
  }
  if (!checklist.proof_approved) return { label: "Needs proof approval", tone: "blocked" };
  return { label: "Ready to order", tone: "blocked" };
}

/** Which board column a whole order sits in, from where its items are. */
export function orderColumn(itemStatuses: string[]): BoardColumn {
  const cols = itemStatuses.map(boardColumn);
  if (cols.length > 0 && cols.every((c) => c === "completed")) return "completed";
  if (cols.length > 0 && cols.every((c) => c === "new_order")) return "new_order";
  return "processing";
}

/**
 * Order-level roll-up from its items (coarser than the board).
 * "begun" = at least one item ordered from the supplier or further on;
 * "finished" = every item dispatched or completed.
 */
export function rollupOrder(subs: { status: string; checklist?: unknown }[]) {
  if (subs.length === 0) return { status: "new_order" as const, finished: false };
  const eff = subs.map((s) => ({ done: s.status === "completed", ticks: effectiveChecklist(s.status, s.checklist) }));
  const allCompleted = eff.every((s) => s.done);
  const begun = eff.some(
    (s) => s.done || s.ticks.ordered_from_supplier || s.ticks.in_production || s.ticks.dispatched
  );
  const finished = eff.every((s) => s.done || s.ticks.dispatched);
  return {
    status: (allCompleted ? "completed" : begun ? "in_production" : "new_order") as
      | "completed"
      | "in_production"
      | "new_order",
    finished,
  };
}

/** Labels for the stored statuses, used where a single status is named. */
export const STATUS_LABEL: Record<SubOrderStatus, string> = {
  new_order: "New order",
  payment_received: "Processing",
  artwork_required: "Processing",
  proof_awaiting_approval: "Processing",
  ready_to_order: "Processing",
  sent_to_supplier: "Processing",
  in_production: "Processing",
  dispatched: "Processing",
  completed: "Completed",
};
