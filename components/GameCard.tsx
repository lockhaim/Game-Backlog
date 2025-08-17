// components/GameCard.tsx
"use client";

import Link from "next/link";
import Image from "next/image";

type Props = {
  game: {
    slug: string;
    title: string;
    headerImageUrl: string | null;
    reviewPercent: number | null;
    tags: string[];
    platforms: string[];
  };
};

export default function GameCard({ game }: Props) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group rounded-2xl border overflow-hidden hover:shadow-md transition"
    >
      <div className="relative w-full aspect-[460/215] bg-gray-100">
        {game.headerImageUrl ? (
          <Image
            src={game.headerImageUrl}
            alt={game.title}
            fill
            className="object-cover transition-transform group-hover:scale-[1.02]"
            sizes="(max-width: 1280px) 50vw, 25vw"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-gray-400 text-sm">
            No Image
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium line-clamp-1">{game.title}</h3>
          {game.reviewPercent != null && (
            <span className="text-xs rounded bg-gray-100 px-1.5 py-0.5">
              {game.reviewPercent}%
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {game.platforms.slice(0, 3).map((p) => (
            <span
              key={p}
              className="text-[10px] rounded bg-gray-100 px-1.5 py-0.5"
            >
              {p}
            </span>
          ))}
          {game.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="text-[10px] rounded border px-1.5 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
