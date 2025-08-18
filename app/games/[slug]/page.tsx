// app/games/[slug]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ScreenshotCarousel from "@/components/ScreenshotCarousel";

export const dynamic = "force-dynamic";

type Params = { slug: string };

function formatDate(d?: Date | null) {
  if (!d) return "-";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toString();
  }
}

export default async function GamePage({
  params,
}: {
  params: Promise<Params>;
}) {
  // Next.js (App Router) requires awaiting dynamic params in RSC
  const { slug } = await params;

  const game = await prisma.game.findUnique({
    where: { slug },
    include: {
      screenshots: { orderBy: { sortIndex: "asc" } },
      tags: { include: { tag: true } },
      platforms: { include: { platform: true } },
    },
  });

  if (!game) {
    notFound();
  }

  const tagNames = game.tags.map((t) => t.tag.name);
  const platformNames = game.platforms.map((p) => p.platform.name);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold">{game.title}</h1>
        <Link
          href="/games"
          className="text-sm rounded px-3 py-1 border hover:bg-gray-50"
        >
          ← All games
        </Link>
      </div>

      {/* Header art (if present) */}
      {game.headerImageUrl && (
        <div className="overflow-hidden rounded border bg-black/5">
          <Image
            src={game.headerImageUrl}
            alt={`${game.title} header`}
            width={1200}
            height={450}
            className="w-full h-auto object-cover"
            priority
            unoptimized
          />
        </div>
      )}

      {/* Meta / summary */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          {game.summary && (
            <p className="text-gray-700 leading-relaxed">{game.summary}</p>
          )}

          {/* Platforms */}
          {platformNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {platformNames.map((p) => (
                <span
                  key={p}
                  className="text-xs uppercase tracking-wide px-2 py-1 rounded bg-gray-100 border"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {tagNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagNames.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-1 rounded border bg-white"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="text-gray-500">Released</div>
            <div>{formatDate(game.releaseDate)}</div>

            <div className="text-gray-500">Metacritic</div>
            <div>{game.metacriticScore ?? "-"}</div>

            <div className="text-gray-500">Steam Reviews</div>
            <div>
              {game.steamReviewLabel || "-"}
              {typeof game.steamReviewPercent === "number" && (
                <> ({game.steamReviewPercent}%)</>
              )}
            </div>

            <div className="text-gray-500">Total Reviews</div>
            <div>{game.steamReviewCount ?? "-"}</div>

            <div className="text-gray-500">Steam AppID</div>
            <div>{game.steamAppId}</div>
          </div>
        </aside>
      </div>

      {/* Screenshot count (sanity check) */}
      <p className="text-xs opacity-70">
        {game.screenshots.length} screenshots (from DB)
      </p>

      {/* Carousel */}
      <ScreenshotCarousel
        shots={game.screenshots.map((s) => ({
          imageUrl: s.imageUrl,
          thumbnailUrl: s.thumbnailUrl,
        }))}
      />
    </div>
  );
}
