"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import type { SubOrderStatus } from "@/lib/types";
import {
  CHECKLIST_ITEMS,
  COLUMN_LABEL,
  COLUMN_ORDER,
  COLUMN_STATUS,
  boardColumn,
  checklistProgress,
  type BoardColumn,
  type Checklist,
  type ChecklistKey,
} from "./status";

export type StaffOption = { id: string; full_name: string | null };

export type SubOrderCardData = {
  id: string;
  status: SubOrderStatus;
  /** Ticks saved on the card (already merged with anything an old-style status implies). */
  checklist: Checklist;
  claimedBy: string | null;
  createdAt: string;
  productName: string;
  quantity: number;
  configuration: Record<string, string | string[]>;
  customerName: string | null;
  customerEmail: string | null;
  /** The client's account manager (from the client record), if one is set. */
  accountManager: string | null;
  artworkCount: number;
  /** Set (to the PO number, or "PO" if none given) for managed-client PO orders. */
  poNumber: string | null;
  orderId: string | null;
  /** Rate tier name; "Retail" when none is set. */
  tierName: string;
  tierDiscount: number;
  /** PO order not yet invoiced, so it can be edited. */
  editable: boolean;
};

export function SubOrderCard({
  subOrder,
  staff,
  onUpdateStatus,
  onToggle,
  onClaim,
}: {
  subOrder: SubOrderCardData;
  staff: StaffOption[];
  onUpdateStatus: (id: string, status: SubOrderStatus) => Promise<void>;
  onToggle: (id: string, key: ChecklistKey, checked: boolean) => Promise<void>;
  onClaim: (id: string, claimedBy: string | null) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(
    { status: subOrder.status, checklist: subOrder.checklist, claimedBy: subOrder.claimedBy },
    (
      state,
      update: Partial<{ status: SubOrderStatus; checklist: Checklist; claimedBy: string | null }>
    ) => ({
      ...state,
      ...update,
    })
  );
  const column = boardColumn(optimistic.status);
  const progress = checklistProgress(optimistic.checklist);

  const configSummary = Object.entries(subOrder.configuration)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(" · ");

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {subOrder.productName} × {subOrder.quantity}
        </p>
        {subOrder.editable && subOrder.orderId ? (
          <Link
            href={`/admin/orders/new?edit=${subOrder.orderId}`}
            className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
          >
            Edit order
          </Link>
        ) : null}
      </div>
      {configSummary ? <p className="mt-1 text-xs text-zinc-500">{configSummary}</p> : null}
      <p className="mt-2 text-sm font-medium text-zinc-800">
        {subOrder.customerName ?? subOrder.customerEmail ?? "Unknown customer"}
        {subOrder.poNumber ? (
          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            {subOrder.poNumber}
          </span>
        ) : null}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            subOrder.tierDiscount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
          }`}
          title="Rate tier"
        >
          {subOrder.tierName}
          {subOrder.tierDiscount > 0 ? ` · ${subOrder.tierDiscount}% off` : " · RRP"}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            subOrder.artworkCount > 0 ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"
          }`}
          title="Artwork files"
        >
          {subOrder.artworkCount > 0
            ? `${subOrder.artworkCount} artwork file${subOrder.artworkCount === 1 ? "" : "s"}`
            : "No artwork yet"}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-zinc-600">
        <span className="text-zinc-400">Account manager </span>
        {subOrder.accountManager ?? <span className="text-zinc-400">not set</span>}
      </p>
      <p className="mt-0.5 text-xs text-zinc-400">
        Raised {new Date(subOrder.createdAt).toLocaleDateString("en-NZ")}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <div>
          <p className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-700">
            <span>Progress</span>
            <span className="font-normal text-zinc-500">
              {progress.done} of {progress.total}
            </span>
          </p>
          <ul className="space-y-1">
            {CHECKLIST_ITEMS.map((item) => (
              <li key={item.key}>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={!!optimistic.checklist[item.key]}
                    disabled={isPending}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setError(null);
                      startTransition(async () => {
                        setOptimistic({
                          checklist: { ...optimistic.checklist, [item.key]: checked },
                          ...(checked && column === "new_order" ? { status: COLUMN_STATUS.processing } : {}),
                        });
                        try {
                          await onToggle(subOrder.id, item.key, checked);
                        } catch {
                          setError("Could not update progress");
                        }
                      });
                    }}
                    className="h-3.5 w-3.5 rounded border-zinc-300"
                  />
                  <span className={optimistic.checklist[item.key] ? "text-zinc-500 line-through" : ""}>
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <select
          value={column}
          disabled={isPending}
          aria-label="Board column"
          onChange={(e) => {
            const next = COLUMN_STATUS[e.target.value as BoardColumn];
            setError(null);
            startTransition(async () => {
              setOptimistic({ status: next });
              try {
                await onUpdateStatus(subOrder.id, next);
              } catch {
                setError("Could not update status");
              }
            });
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs"
        >
          {COLUMN_ORDER.map((c) => (
            <option key={c} value={c}>
              {COLUMN_LABEL[c]}
            </option>
          ))}
        </select>

        <label className="-mb-1 text-[11px] text-zinc-400" htmlFor={`assignee-${subOrder.id}`}>
          Assigned to
        </label>
        <select
          id={`assignee-${subOrder.id}`}
          value={optimistic.claimedBy ?? ""}
          disabled={isPending}
          onChange={(e) => {
            const next = e.target.value || null;
            setError(null);
            startTransition(async () => {
              setOptimistic({ claimedBy: next });
              try {
                await onClaim(subOrder.id, next);
              } catch {
                setError("Could not update assignee");
              }
            });
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-xs"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? "Unnamed staff"}
            </option>
          ))}
        </select>
        {isPending ? (
          <p className="flex items-center gap-1.5 text-[11px] text-orange-500">
            <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-orange-200 border-t-orange-500" />
            Saving…
          </p>
        ) : error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : null}
      </div>
    </li>
  );
}
