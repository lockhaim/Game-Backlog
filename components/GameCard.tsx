// components/GameCard.tsx
import Link from "next/link";
import Image from "next/image";

type Props = {
  title: string;
  slug: string;
  headerImageUrl: string | null;
  metacriticScore: number | null;
  steamReviewPercent: number | null;
  tags: string[];
};

export default function GameCard({
  title,
  slug,
  headerImageUrl,
  metacriticScore,
  steamReviewPercent,
  tags,
}: Props) {
  return (
    <Link
      href={`/games/${slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-shadow hover:shadow-[0_0_0_1px_var(--ring),0_8px_30px_rgba(0,0,0,.35)]"
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-black/40">
        {headerImageUrl ? (
          <Image
            src={headerImageUrl}
            alt={title}
            width={640}
            height={360}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            No image
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        <h3 className="line-clamp-1 font-semibold tracking-tight text-[var(--fg)]">
          {title}
        </h3>

        <div className="flex items-center gap-2 text-xs">
          {metacriticScore !== null && (
            <span className="rounded bg-[var(--accent-2)]/25 px-2 py-0.5 text-[var(--fg)]">
              MC {metacriticScore}
            </span>
          )}
          {steamReviewPercent !== null && (
            <span className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">
              {steamReviewPercent}% 👍
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* subtle accent bar on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 scale-x-0 bg-[var(--accent)] transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}
