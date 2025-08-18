import Image from "next/image";
import Link from "next/link";

type GameCardProps = {
  slug: string;
  title: string;
  headerImageUrl?: string | null;
  steamReviewLabel?: string | null;
  steamReviewPercent?: number | null;
  metacriticScore?: number | null;
  tags?: string[];
};

export default function GameCard({
  slug,
  title,
  headerImageUrl,
  steamReviewLabel,
  steamReviewPercent,
  metacriticScore,
  tags = [],
}: GameCardProps) {
  return (
    <Link
      href={`/games/${slug}`}
      className="group rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 hover:bg-neutral-900/60 transition-colors"
    >
      <div className="relative h-40 w-full bg-neutral-900">
        {headerImageUrl ? (
          <Image
            src={headerImageUrl}
            alt={title}
            fill
            sizes="(max-width:768px) 100vw, 33vw"
            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-neutral-500">
            No image
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <h3 className="text-base font-medium line-clamp-2">{title}</h3>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {typeof steamReviewPercent === "number" && steamReviewLabel && (
            <span className="rounded-full border border-emerald-700/50 bg-emerald-900/30 px-2 py-0.5 text-emerald-200">
              {steamReviewLabel} ({steamReviewPercent}%)
            </span>
          )}
          {typeof metacriticScore === "number" && (
            <span className="rounded-full border border-sky-700/50 bg-sky-900/30 px-2 py-0.5 text-sky-200">
              MC {metacriticScore}
            </span>
          )}
        </div>

        {!!tags?.length && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[10px] rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-neutral-400"
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
