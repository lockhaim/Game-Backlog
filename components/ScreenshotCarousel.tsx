// components/ScreenshotCarousel.tsx
"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Shot = { imageUrl: string; thumbnailUrl?: string | null };

export default function ScreenshotCarousel({ shots }: { shots: Shot[] }) {
  const images = useMemo(
    () => (shots ?? []).filter((s) => !!s?.imageUrl),
    [shots]
  );
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const clamp = (i: number) =>
    Math.max(0, Math.min(i, Math.max(0, images.length - 1)));

  const go = useCallback(
    (i: number) => setIdx(clamp(i)),
    [setIdx, images.length]
  );
  const prev = useCallback(() => go(idx - 1), [idx, go]);
  const next = useCallback(() => go(idx + 1), [idx, go]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  // Snap to current slide (smooth)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const child = el.children[idx] as HTMLElement | undefined;
    if (child) child.scrollIntoView({ behavior: "smooth", inline: "center" });
  }, [idx]);

  // Basic drag / swipe
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let startX = 0;
    let lastX = 0;
    let down = false;

    const onDown = (e: PointerEvent) => {
      down = true;
      startX = e.clientX;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - lastX;
      el.scrollLeft -= dx;
      lastX = e.clientX;
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      el.releasePointerCapture(e.pointerId);
      const total = e.clientX - startX;
      if (Math.abs(total) > 50) {
        total < 0 ? next() : prev();
      } else {
        // snap back to current
        const child = el.children[idx] as HTMLElement | undefined;
        if (child) child.scrollIntoView({ behavior: "smooth", inline: "center" });
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [idx, next, prev]);

  if (!images.length) return null;

  return (
    <div className="space-y-3">
      {/* Main slide */}
      <div className="relative">
        <div
          ref={trackRef}
          className="flex gap-2 overflow-x-auto scroll-smooth snap-x snap-mandatory rounded border bg-black/5"
          style={{ scrollBehavior: "smooth" }}
        >
          {images.map((s, i) => (
            <div
              key={i}
              className="min-w-full snap-center p-2 flex items-center justify-center"
            >
              {/* Fixed size avoids layout thrash; unoptimized avoids CDN gotchas */}
              <Image
                src={s.imageUrl}
                alt={`Screenshot ${i + 1}`}
                width={1280}
                height={720}
                className="w-full h-auto object-contain select-none"
                draggable={false}
                priority={i <= 1}
                loading={i > 1 ? "lazy" : "eager"}
                unoptimized
              />
            </div>
          ))}
        </div>

        {/* Prev/Next buttons */}
        <button
          aria-label="Previous"
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/40 hover:bg-black/60 text-white"
        >
          <ChevronLeft />
        </button>
        <button
          aria-label="Next"
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/40 hover:bg-black/60 text-white"
        >
          <ChevronRight />
        </button>

        {/* Position indicator */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {images.map((_, i) => (
            <span
              key={i}
              onClick={() => go(i)}
              className={`h-1.5 w-6 rounded-full cursor-pointer transition ${
                i === idx ? "bg-white/90" : "bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto">
        {images.map((s, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className={`relative border rounded overflow-hidden focus:outline-none ${
              i === idx ? "ring-2 ring-indigo-500" : "opacity-80 hover:opacity-100"
            }`}
            aria-label={`Select screenshot ${i + 1}`}
          >
            <Image
              src={s.thumbnailUrl || s.imageUrl}
              alt={`Thumb ${i + 1}`}
              width={200}
              height={112}
              className="block"
              unoptimized
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
