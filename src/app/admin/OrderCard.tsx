"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import type { SubOrderStatus } from "@/lib/types";
import { UploadProgress } from "@/components/UploadProgress";
import { uploadWithProgress } from "@/lib/upload-with-progress";
import type { ProofSummary } from "@/lib/proofs";
import {
  CHECKLIST_ITEMS,
  COLUMN_LABEL,
  COLUMN_ORDER,
  COLUMN_STATUS,
  boardColumn,
  checklistProgress,
  itemState,
  type BoardColumn,
  type Checklist,
  type ChecklistKey,
  type ItemStateTone,
} from "./status";

export type StaffOption = { id: string; full_name: string | null };

export type ItemData = {
  id: string;
  status: SubOrderStatus;
  /** Ticks saved on the item (already merged with anything an old-style status implies). */
  checklist: Checklist;
  claimedBy: string | null;
  productName: string;
  quantity: number;
  configuration: Record<string, string | string[]>;
  artworkCount: number;
  /** The files themselves, each with a temporary link to open it (null if a link could not be made). */
  artworkFiles: { id: string; name: string; url: string | null }[];
  /** The order line this item is, needed to attach a proof to it. */
  lineId: string | null;
  /** Proofs sent to the customer for this item, newest first. */
  proofs: ProofSummary[];
};

export type OrderCardData = {
  /** Order id, or the item id for an item with no order attached. */
  key: string;
  orderId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  /** The client's account manager (from the client record), if one is set. */
  accountManager: string | null;
  /** Set (to the PO number, or "PO" if none given) for managed-client PO orders. */
  poNumber: string | null;
  /** Rate tier name; "Retail" when none is set. */
  tierName: string;
  tierDiscount: number;
  /** PO order not yet invoiced, so it can be edited. */
  editable: boolean;
  createdAt: string;
  items: ItemData[];
};

const TONE_CLASS: Record<ItemStateTone, string> = {
  blocked: "bg-amber-100 text-amber-800",
  progress: "bg-sky-100 text-sky-800",
  done: "bg-emerald-100 text-emerald-800",
};

export function OrderCard({
  order,
  staff,
  onUpdateStatus,
  onToggle,
  onClaim,
}: {
  order: OrderCardData;
  staff: StaffOption[];
  onUpdateStatus: (id: string, status: SubOrderStatus) => Promise<void>;
  onToggle: (id: string, key: ChecklistKey, checked: boolean) => Promise<void>;
  onClaim: (id: string, claimedBy: string | null) => Promise<void>;
}) {
  const total = order.items.length;
  const states = order.items.map((i) => itemState(i.status, i.checklist, i.artworkCount, i.proofs[0]?.status ?? null));
  const doneCount = states.filter((s) => s.tone === "done").length;
  const blockedCount = states.filter((s) => s.tone === "blocked").length;
  // Card orders (no PO) where an item still has no artwork: staff can chase the customer.
  const canChase =
    !!order.orderId &&
    !!order.customerEmail &&
    order.poNumber === null &&
    order.items.some((i, idx) => i.artworkCount === 0 && states[idx].tone !== "done");

  // Proofs are for card orders: the customer approves them on their order page.
  const canProof = !!order.orderId && order.poNumber === null;

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-zinc-900">
          {order.customerName ?? order.customerEmail ?? "Unknown customer"}
          {order.poNumber ? (
            <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              {order.poNumber}
            </span>
          ) : null}
        </p>
        {order.editable && order.orderId ? (
          <Link
            href={`/admin/orders/new?edit=${order.orderId}`}
            className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-zinc-900 hover:text-zinc-900"
          >
            Edit order
          </Link>
        ) : null}
      </div>

      <p className="mt-1 text-xs text-zinc-700">
        <span className="font-medium">
          {doneCount} of {total} {total === 1 ? "item" : "items"} done
        </span>
        {blockedCount > 0 ? (
          <span className="text-amber-700"> · {blockedCount} need{blockedCount === 1 ? "s" : ""} attention</span>
        ) : null}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            order.tierDiscount > 0 ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
          }`}
          title="Rate tier"
        >
          {order.tierName}
          {order.tierDiscount > 0 ? ` · ${order.tierDiscount}% off` : " · RRP"}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-700">
        <span className="font-medium text-zinc-500">Account manager: </span>
        {order.accountManager ?? <span className="text-zinc-400">not set</span>}
      </p>
      <p className="mt-0.5 text-xs text-zinc-400">Raised {new Date(order.createdAt).toLocaleDateString("en-NZ")}</p>

      {canChase && order.orderId ? <ChaseArtworkButton orderId={order.orderId} /> : null}

      <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100">
        {order.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            orderId={canProof ? order.orderId : null}
            staff={staff}
            startOpen={total === 1}
            onUpdateStatus={onUpdateStatus}
            onToggle={onToggle}
            onClaim={onClaim}
          />
        ))}
      </ul>
    </li>
  );
}

/** Emails the customer a reminder for each product still missing artwork, with a link to upload it. */
function ChaseArtworkButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/artwork-reminder`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? { ok: true, text: `Reminder sent to ${data.sentTo}` }
          : { ok: false, text: data.error ?? "Could not send the reminder" }
      );
    } catch {
      setMessage({ ok: false, text: "Could not send the reminder. Check your connection." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Email artwork reminder"}
      </button>
      {message ? (
        <p className={`mt-1 text-[11px] ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>
      ) : null}
    </div>
  );
}

/** Attach a proof for the customer to view and approve, and see the ones already sent. */
function ProofSection({ orderId, item }: { orderId: string; item: ItemData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState(true);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file || !item.lineId) return;
    setBusy(true);
    setMessage(null);
    setProgress({ name: file.name, percent: 0 });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("lineId", item.lineId);
      form.append("notify", notify ? "1" : "0");
      const res = await uploadWithProgress(`/api/orders/${orderId}/proofs`, form, (percent) =>
        setProgress({ name: file.name, percent })
      );
      if (!res.ok) {
        setMessage({
          ok: false,
          text: res.status === 413 ? "That file is too large to upload here." : String(res.data.error ?? "Upload failed."),
        });
        return;
      }
      const emailNote = !notify
        ? "Proof attached. The customer was not emailed."
        : res.data.emailed
          ? "Proof attached and the customer was emailed."
          : `Proof attached, but the email failed: ${String(res.data.emailError ?? "unknown error")}`;
      setMessage({ ok: !notify || res.data.emailed === true, text: emailNote });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Upload failed. Check your connection and try again." });
    } finally {
      setBusy(false);
      setProgress(null);
      input.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-700">Proof for the customer</p>
      {item.proofs.length > 0 ? (
        <ul className="mb-2 space-y-0.5">
          {item.proofs.map((p, i) => (
            <li key={p.id} className="text-xs text-zinc-600">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:text-brand-orange">
                  {p.name}
                </a>
              ) : (
                <span className="break-all">{p.name}</span>
              )}{" "}
              <span className="text-zinc-400">
                {i === 0 ? "(latest) " : ""}
                {p.status === "approved" ? "approved" : p.status === "changes_requested" ? "changes requested" : "awaiting approval"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="mb-2 flex items-center gap-2 text-xs text-zinc-700">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy} className="h-3.5 w-3.5 rounded border-zinc-300" />
        Email the customer when it is attached
      </label>
      <label
        className={`inline-block cursor-pointer rounded border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 ${busy ? "opacity-60" : ""}`}
      >
        {busy ? "Uploading…" : item.proofs.length > 0 ? "Attach a new proof" : "Attach proof"}
        <input type="file" accept=".jpg,.jpeg,.png,.webp,.svg,.pdf" onChange={upload} disabled={busy} className="hidden" />
      </label>
      {progress ? <UploadProgress fileName={progress.name} percent={progress.percent} /> : null}
      {message ? <p className={`mt-1 text-[11px] ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p> : null}
    </div>
  );
}

function ItemRow({
  item,
  orderId,
  staff,
  startOpen,
  onUpdateStatus,
  onToggle,
  onClaim,
}: {
  item: ItemData;
  /** Set when staff can attach proofs to this item (card orders). */
  orderId: string | null;
  staff: StaffOption[];
  startOpen: boolean;
  onUpdateStatus: (id: string, status: SubOrderStatus) => Promise<void>;
  onToggle: (id: string, key: ChecklistKey, checked: boolean) => Promise<void>;
  onClaim: (id: string, claimedBy: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(startOpen);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useOptimistic(
    { status: item.status, checklist: item.checklist, claimedBy: item.claimedBy },
    (
      state,
      update: Partial<{ status: SubOrderStatus; checklist: Checklist; claimedBy: string | null }>
    ) => ({
      ...state,
      ...update,
    })
  );
  const column = boardColumn(optimistic.status);
  const state = itemState(optimistic.status, optimistic.checklist, item.artworkCount, item.proofs[0]?.status ?? null);
  const progress = checklistProgress(optimistic.checklist);

  const configSummary = Object.entries(item.configuration)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join(" · ");

  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <span className="font-medium text-zinc-900">
          {item.productName} × {item.quantity}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE_CLASS[state.tone]}`}>
          {state.label}
        </span>
      </button>
      <p className="mt-0.5 text-[11px] text-zinc-400">
        {progress.done}/{progress.total} steps ·{" "}
        {item.artworkCount > 0
          ? `${item.artworkCount} artwork file${item.artworkCount === 1 ? "" : "s"}`
          : "no artwork yet"}
        <button type="button" onClick={() => setOpen((o) => !o)} className="ml-1.5 underline hover:text-zinc-700">
          {open ? "Hide" : "Details"}
        </button>
      </p>
      {item.artworkFiles.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {item.artworkFiles.map((f) => (
            <li key={f.id} className="flex items-start gap-1 text-xs">
              <span className="shrink-0 text-zinc-400">Artwork:</span>
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-medium text-zinc-900 underline underline-offset-2 hover:text-brand-orange"
                >
                  {f.name}
                </a>
              ) : (
                <span className="break-all text-zinc-500">{f.name} (refresh for link)</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {item.proofs[0] ? (
        <p className="mt-1 text-xs text-zinc-600">
          <span className="text-zinc-400">Proof:</span>{" "}
          {item.proofs[0].status === "approved"
            ? "approved by customer"
            : item.proofs[0].status === "changes_requested"
              ? "changes requested"
              : "sent, awaiting approval"}
          {item.proofs[0].status === "changes_requested" && item.proofs[0].note ? (
            <span className="block italic text-amber-800">&ldquo;{item.proofs[0].note}&rdquo;</span>
          ) : null}
        </p>
      ) : null}

      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          {configSummary ? <p className="text-xs text-zinc-500">{configSummary}</p> : null}
          {orderId && item.lineId ? <ProofSection orderId={orderId} item={item} /> : null}
          <div>
            <p className="mb-1 text-xs font-medium text-zinc-700">Progress</p>
            <ul className="space-y-1">
              {CHECKLIST_ITEMS.map((step) => (
                <li key={step.key}>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-700">
                    <input
                      type="checkbox"
                      checked={!!optimistic.checklist[step.key]}
                      disabled={isPending}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setError(null);
                        startTransition(async () => {
                          setOptimistic({
                            checklist: { ...optimistic.checklist, [step.key]: checked },
                            ...(checked && column === "new_order" ? { status: COLUMN_STATUS.processing } : {}),
                          });
                          try {
                            await onToggle(item.id, step.key, checked);
                          } catch {
                            setError("Could not update progress");
                          }
                        });
                      }}
                      className="h-3.5 w-3.5 rounded border-zinc-300"
                    />
                    <span className={optimistic.checklist[step.key] ? "text-zinc-500 line-through" : ""}>
                      {step.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <select
            value={column}
            disabled={isPending}
            aria-label="Item status"
            onChange={(e) => {
              const next = COLUMN_STATUS[e.target.value as BoardColumn];
              setError(null);
              startTransition(async () => {
                setOptimistic({ status: next });
                try {
                  await onUpdateStatus(item.id, next);
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

          <label className="-mb-1 text-xs font-medium text-zinc-500" htmlFor={`assignee-${item.id}`}>
            Assigned to:
          </label>
          <select
            id={`assignee-${item.id}`}
            value={optimistic.claimedBy ?? ""}
            disabled={isPending}
            onChange={(e) => {
              const next = e.target.value || null;
              setError(null);
              startTransition(async () => {
                setOptimistic({ claimedBy: next });
                try {
                  await onClaim(item.id, next);
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
        </div>
      ) : null}

      {isPending ? (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-orange-500">
          <span className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-orange-200 border-t-orange-500" />
          Saving…
        </p>
      ) : error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : null}
    </li>
  );
}
