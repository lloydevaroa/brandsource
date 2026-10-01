"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) return null;

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <Image
          key={images[active]}
          src={images[active]}
          alt={name}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 576px"
          priority={active === 0}
        />
      </div>
      {images.length > 1 ? (
        <ul className="mt-3 grid grid-cols-4 gap-3">
          {images.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === active}
                className={`relative block aspect-square w-full overflow-hidden rounded-lg border bg-white ${
                  i === active ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <Image src={src} alt="" fill className="object-contain" sizes="144px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
