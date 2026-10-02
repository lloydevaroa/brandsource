"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { deleteHeroSlide, moveHeroSlide, saveHeroSlide } from "./actions";

type Slide = {
  id: string;
  image_url: string;
  headline: string | null;
  button_label: string | null;
  button_href: string | null;
  active: boolean;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

export function HeroSlideCard({ slide, first, last }: { slide: Slide; first: boolean; last: boolean }) {
  const [saving, startSave] = useTransition();
  const [moving, startMove] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const busy = saving || moving || deleting;

  useEffect(() => {
    if (notice?.kind !== "ok") return;
    const t = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setNotice(null);
    startSave(async () => {
      try {
        const res = await saveHeroSlide(data);
        setNotice(res.ok ? { kind: "ok", text: "Saved" } : { kind: "error", text: res.error ?? "Could not save." });
      } catch {
        setNotice({ kind: "error", text: "Could not save. Refresh the page and try again." });
      }
    });
  }

  function onMove(dir: "up" | "down") {
    const data = new FormData();
    data.set("id", slide.id);
    data.set("dir", dir);
    setNotice(null);
    startMove(async () => {
      try {
        await moveHeroSlide(data);
      } catch {
        setNotice({ kind: "error", text: "Could not move. Refresh the page and try again." });
      }
    });
  }

  function onDelete() {
    if (!window.confirm("Delete this image? This can't be undone.")) return;
    const data = new FormData();
    data.set("id", slide.id);
    setNotice(null);
    startDelete(async () => {
      try {
        await deleteHeroSlide(data);
      } catch {
        setNotice({ kind: "error", text: "Could not delete. Refresh the page and try again." });
      }
    });
  }

  return (
    <li
      className={`rounded-xl border border-zinc-200 bg-white p-5 transition-opacity ${
        deleting || moving ? "opacity-50" : ""
      }`}
      aria-busy={busy}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative aspect-[21/9] w-full shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:w-64">
          <Image src={slide.image_url} alt="" fill sizes="256px" className="object-cover" />
        </div>
        <form onSubmit={onSave} className="flex-1 space-y-3">
          <input type="hidden" name="id" value={slide.id} />
          <input
            name="headline"
            defaultValue={slide.headline ?? ""}
            placeholder="Headline (optional)"
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="button_label"
              defaultValue={slide.button_label ?? ""}
              placeholder="Button text (optional)"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            />
            <input
              name="button_href"
              defaultValue={slide.button_href ?? ""}
              placeholder="Button link, e.g. /category/lanyards"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="active" defaultChecked={slide.active} />
              Show on site
            </label>
            <div className="flex items-center gap-3">
              {notice ? (
                <span
                  role="status"
                  className={`text-sm ${notice.kind === "ok" ? "text-green-700" : "text-red-600"}`}
                >
                  {notice.kind === "ok" ? "✓ " : ""}
                  {notice.text}
                </span>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div className="mt-3 flex gap-4 border-t border-zinc-100 pt-3 text-sm">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={first || busy}
          className="text-zinc-600 hover:text-zinc-900 disabled:opacity-30"
        >
          {moving ? "Moving…" : "↑ Move earlier"}
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={last || busy}
          className="text-zinc-600 hover:text-zinc-900 disabled:opacity-30"
        >
          ↓ Move later
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="ml-auto text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}
