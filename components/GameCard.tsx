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
};

const STEAM_HEADER_ASPECT = "214 / 100"; // ~2.14:1 (Steam header shape)

export default function GameCard({
  title,
  slug,
  headerImageUrl,
  metacriticScore,
  steamReviewPercent,
  tags = [],
}: Props) {
  return (
    <Link
      href={`/games/${slug}`}
      aria-label={`Open ${title}`}
      className={[
        "group relative z-0 block rounded-2xl",
        "border border-[var(--border)] bg-[var(--card)] shadow-sm",
        "transition-all duration-300 ease-out transform-gpu",
        "hover:scale-[1.30] hover:shadow-2xl hover:border-[var(--accent)]",
        "hover:z-20 focus-visible:z-20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        // let the scaled card overlap neighbors; inner media wrapper will clip
        "overflow-visible",
      ].join(" ")}
    >
      {/* Media */}
      <div
        className="relative w-full overflow-hidden rounded-t-2xl bg-[var(--card-ink)]"
        style={{ aspectRatio: STEAM_HEADER_ASPECT }}
      >
        {headerImageUrl ? (
          <Image
            src={headerImageUrl}
            alt={title}
            fill
            // show the whole image (no cropping)
            className="object-contain transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[var(--muted)]">
            <span className="text-sm">No image</span>
          </div>
        )}
        {/* Soft vignette so letterbox bars feel intentional */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-[var(--fg)]">
          {title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          {typeof metacriticScore === "number" && (
            <span className="rounded-md border border-[var(--border)] bg-[var(--chip)] px-2 py-0.5 text-[var(--fg)]">
              Metacritic {metacriticScore}
            </span>
          )}
          {typeof steamReviewPercent === "number" && (
            <span className="rounded-md border border-[var(--border)] bg-[var(--chip)] px-2 py-0.5 text-[var(--fg)]">
              {steamReviewPercent}% positive
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-md border border-[var(--border)] bg-[var(--chip)] px-2 py-0.5 text-xs text-[var(--muted)]"
              >
                {t}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="rounded-md border border-[var(--border)] bg-[var(--chip)] px-2 py-0.5 text-xs text-[var(--muted)]">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Focus/hover ring */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-[var(--accent)] transition-all duration-300 ease-out group-hover:ring-2" />
    </Link>
  );
}
