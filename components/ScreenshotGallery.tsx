// components/ScreenshotGallery.tsx
"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Shot = { imageUrl: string; thumbnailUrl?: string | null };

export default function ScreenshotGallery({ shots }: { shots: Shot[] }) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const openAt = (i: number) => {
    setIdx(i);
    setOpen(true);
  };

  const close = () => setOpen(false);
  const prev = useCallback(
    () => setIdx((i) => (i - 1 + shots.length) % shots.length),
    [shots.length]
  );
  const next = useCallback(
    () => setIdx((i) => (i + 1) % shots.length),
    [shots.length]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  if (!shots?.length) return null;

  return (
    <>
      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {shots.map((s, i) => (
          <button
            key={i}
            onClick={() => openAt(i)}
            className="group relative overflow-hidden rounded border bg-black/5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={`Open screenshot ${i + 1}`}
          >
            {/* fixed sizes avoid layout surprises */}
            <Image
              src={s.thumbnailUrl || s.imageUrl}
              alt={`Screenshot ${i + 1}`}
              width={640}
              height={360}
              className="w-full h-auto object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              loading={i > 2 ? "lazy" : "eager"}
              priority={i < 2}
              unoptimized
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={close}
          aria-modal="true"
          role="dialog"
        >
          <button
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="absolute top-4 right-4 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          >
            <X />
          </button>

          <button
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 md:left-6 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          >
            <ChevronLeft />
          </button>

          <figure
            className="max-w-[95vw] max-h-[85vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={shots[idx].imageUrl}
              alt={`Screenshot ${idx + 1}`}
              width={1920}
              height={1080}
              className="w-auto max-w-full h-auto max-h-[85vh] object-contain select-none"
              unoptimized
              priority
            />
            <figcaption className="text-center text-white/70 text-xs mt-2">
              {idx + 1} / {shots.length}
            </figcaption>
          </figure>

          <button
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 md:right-6 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </>
  );
}
