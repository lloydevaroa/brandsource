"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { HeroSlide } from "@/lib/hero";

const INTERVAL_MS = 6000;

/** Words wrapped in *asterisks* render in brand orange, e.g. "Brands *People* Remember". */
function Headline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).map((part, k) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <span key={k} className="text-brand-orange">
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative w-full overflow-hidden bg-zinc-200"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div
        className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className="relative aspect-[16/9] max-h-[32rem] w-full shrink-0 sm:aspect-[21/9]"
          >
            <Image
              src={s.image_url}
              alt={s.headline ?? ""}
              fill
              priority={i === 0}
              sizes="100vw"
              className="object-cover"
            />
            {s.headline || s.button_label ? (
              <div className="absolute inset-0 flex items-center bg-gradient-to-r from-brand-charcoal/70 via-brand-charcoal/25 to-transparent">
                <div className="mx-auto w-full max-w-6xl px-6">
                  {s.headline ? (
                    <p className="max-w-md text-3xl font-extrabold uppercase leading-[1.02] tracking-tight text-white sm:max-w-xl sm:text-5xl lg:text-6xl">
                      <Headline text={s.headline} />
                    </p>
                  ) : null}
                  {s.button_label && s.button_href ? (
                    <Link
                      href={s.button_href}
                      tabIndex={i === index ? 0 : -1}
                      className="mt-6 inline-block px-5 py-2.5 text-sm rounded bg-brand-orange text-white font-bold uppercase tracking-wide hover:bg-[#e64300]"
                    >
                      {s.button_label} <span aria-hidden>&rarr;</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-zinc-900 hover:bg-white sm:flex"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-zinc-900 hover:bg-white sm:flex"
          >
            <span aria-hidden>›</span>
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
