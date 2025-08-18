// components/GameCard.tsx
import Link from "next/link";
import Image from "next/image";

type GameCardProps = {
  game: {
    title: string;
    slug: string;
    headerImageUrl: string | null;
    metacriticScore: number | null;
    steamReviewPercent: number | null;
    tags?: string[] | null;
  };
};

export default function GameCard({ game }: GameCardProps) {
  const {
    title,
    slug,
    headerImageUrl,
    metacriticScore,
    steamReviewPercent,
  } = game;

  // Be defensive: normalize tags to an array
  const tags = Array.isArray(game.tags) ? game.tags : [];

  return (
    <Link
      href={`/games/${slug}`}
      className="group block overflow-hidden rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
    >
      <div className="relative h-40 w-full bg-gray-100">
        {headerImageUrl ? (
          <Image
            src={headerImageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            priority={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <h3 className="font-medium leading-tight line-clamp-2">{title}</h3>

        <div className="text-xs text-gray-600 flex gap-3">
          {metacriticScore != null && <span>Metacritic: {metacriticScore}</span>}
          {steamReviewPercent != null && <span>Steam: {steamReviewPercent}%</span>}
        </div>

        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
