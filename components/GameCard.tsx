// components/GameCard.tsx
import Link from "next/link";
import Image from "next/image";

type Props = {
  title: string;
  slug: string;
  headerImageUrl: string | null;
  metacriticScore: number | null;
  steamReviewPercent: number | null;
  tags?: string[];
  platforms?: string[];
};

function badgeColor(score: number | null) {
  if (score == null) return "bg-gray-100 text-gray-600";
  if (score >= 85) return "bg-emerald-100 text-emerald-700";
  if (score >= 70) return "bg-lime-100 text-lime-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function steamColor(pct: number | null) {
  if (pct == null) return "bg-gray-100 text-gray-600";
  if (pct >= 85) return "bg-sky-100 text-sky-700";
  if (pct >= 70) return "bg-cyan-100 text-cyan-700";
  if (pct >= 50) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export default function GameCard({
  title,
  slug,
  headerImageUrl,
  metacriticScore,
  steamReviewPercent,
  tags = [],
  platforms = [],
}: Props) {
  const firstLetter = title?.[0]?.toUpperCase() ?? "?";

  return (
    <Link
      href={`/games/${slug}`}
      className="group block rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gray-200"
    >
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl bg-gradient-to-br from-gray-50 to-gray-100">
        {headerImageUrl ? (
          <Image
            src={headerImageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-gray-300">
            {firstLetter}
          </div>
        )}

        {/* subtle gradient overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/40 to-transparent"></div>

        {/* quick badges overlay */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex gap-1">
          {metacriticScore != null && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur ${badgeColor(metacriticScore)} shadow`}>
              MC {metacriticScore}
            </span>
          )}
          {steamReviewPercent != null && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur ${steamColor(steamReviewPercent)} shadow`}>
              Steam {steamReviewPercent}%
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-gray-900 group-hover:text-gray-700">
          {title}
        </h3>

        {/* tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
              >
                {t}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* platforms */}
        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {platforms.slice(0, 3).map((p) => (
              <span
                key={p}
                className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600"
              >
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
