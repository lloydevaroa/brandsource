"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isImageName, type ProofSummary } from "@/lib/proofs";

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

/** The newest proof for one item: view it, then approve it or ask for changes. */
export function ProofReview({ orderId, proof }: { orderId: string; proof: ProofSummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "approve" | "request_changes") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/proofs/${proof.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setAsking(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <p className="text-sm font-medium">Your proof</p>

      {proof.url ? (
        isImageName(proof.name) ? (
          <a href={proof.url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proof.url}
              alt={`Proof: ${proof.name}`}
              className="max-h-96 w-auto max-w-full rounded-lg border border-zinc-200 bg-white object-contain"
            />
          </a>
        ) : (
          <a
            href={proof.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded border border-brand-charcoal px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-charcoal hover:bg-brand-charcoal hover:text-white"
          >
            Open proof ({proof.name})
          </a>
        )
      ) : (
        <p className="mt-2 text-sm text-zinc-500">We couldn&apos;t load the proof just now. Refresh the page to try again.</p>
      )}
      <p className="mt-1 text-xs text-zinc-500">Sent {longDate(proof.sentAt ?? proof.createdAt)}. Click it to open full size.</p>

      {proof.status === "awaiting_approval" ? (
        <div className="mt-4">
          <p className="text-sm text-zinc-700">
            Check the sizes, colours, spelling and positioning. Nothing is made until you approve it.
          </p>
          {asking ? (
            <div className="mt-3">
              <label htmlFor={`note-${proof.id}`} className="text-sm font-medium">
                What would you like changed?
              </label>
              <textarea
                id={`note-${proof.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => respond("request_changes")}
                  disabled={busy || note.trim().length === 0}
                  className="rounded bg-brand-charcoal px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-black disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setAsking(false)}
                  disabled={busy}
                  className="px-3 py-2 text-sm text-zinc-500 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => respond("approve")}
                disabled={busy}
                className="rounded bg-brand-orange px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#e64300] disabled:opacity-60"
              >
                {busy ? "Saving…" : "Approve proof"}
              </button>
              <button
                type="button"
                onClick={() => setAsking(true)}
                disabled={busy}
                className="rounded border border-brand-charcoal px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-charcoal hover:bg-brand-charcoal hover:text-white disabled:opacity-60"
              >
                Request changes
              </button>
            </div>
          )}
        </div>
      ) : null}

      {proof.status === "approved" ? (
        <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          You approved this proof. Thanks, we&apos;ll move your order on to production.
        </p>
      ) : null}

      {proof.status === "changes_requested" ? (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p>You asked for changes. We&apos;ll send you a new proof to approve.</p>
          {proof.note ? <p className="mt-1 italic">&ldquo;{proof.note}&rdquo;</p> : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
