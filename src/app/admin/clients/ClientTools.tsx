"use client";

import { useState, useTransition } from "react";
import type { RateTier } from "@/lib/rate-tiers";
import { linkLoginToClient, setClientRateTier } from "./actions";

export function ClientTierSelect({
  clientId,
  tierId,
  tiers,
}: {
  clientId: string;
  tierId: string | null;
  tiers: RateTier[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const retail = tiers.find((t) => t.discount_percent === 0);
  return (
    <span className="flex items-center gap-2">
      <select
        defaultValue={tierId ?? retail?.id ?? ""}
        disabled={isPending || tiers.length <= 1}
        onChange={(e) => {
          setError(null);
          const value = e.target.value === retail?.id ? "" : e.target.value;
          startTransition(async () => {
            try {
              await setClientRateTier(clientId, value);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save tier.");
            }
          });
        }}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
        aria-label="Rate tier"
      >
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.discount_percent > 0 ? ` ${t.discount_percent}%` : ""}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}

export function LinkLoginForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        startTransition(async () => {
          try {
            await linkLoginToClient({ email, clientId });
            setMessage({ ok: true, text: `Linked ${email}. Their client's rate tier now applies when they sign in.` });
            setEmail("");
          } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not link login." });
          }
        });
      }}
      className="rounded-xl border border-zinc-200 bg-white p-5"
    >
      <h2 className="text-sm font-semibold">Link a customer login to a client</h2>
      <p className="mt-1 text-xs text-zinc-500">
        So a customer who signs in gets their client&apos;s rate tier. They must have signed in once already.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Customer&apos;s login email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Client</span>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message ? <p className={`mt-3 text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p> : null}
      <button
        type="submit"
        disabled={isPending || clients.length === 0}
        className="mt-4 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {isPending ? "Linking…" : "Link login"}
      </button>
    </form>
  );
}
