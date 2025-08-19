// app/games/[slug]/page.tsx
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import ScreenshotCarousel from "@/components/ScreenshotCarousel";

type PageProps = {
  params: Promise<{ slug: string }>; // Next 15 dynamic params are async
};

async function getParams(p: PageProps["params"]) {
  return await p;
}

export default async function GamePage({ params }: PageProps) {
  const { slug } = await getParams(params);

  const game = await prisma.game.findUnique({
    where: { slug },
    include: {
      screenshots: { orderBy: { sortIndex: "asc" } },
      tags: { include: { tag: true } },
      platforms: { include: { platform: true } },
    },
  });

  if (!game) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold title-accent">Not found</h1>
        <p className="text-[hsl(var(--muted))]">This game doesn’t exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="card overflow-hidden">
        <div className="relative aspect-[21/9] w-full">
          {game.headerImageUrl ? (
            <>
              <Image
                src={game.headerImageUrl}
                alt={game.title}
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[hsl(var(--muted))]">
              No image
            </div>
          )}
        </div>

        <div className="p-6">
          <h1 className="text-3xl font-semibold title-accent">{game.title}</h1>

          <div className="mt-3 flex flex-wrap gap-2">
            {game.metacriticScore != null && (
              <span className="badge badge-purple">MC {game.metacriticScore}</span>
            )}
            {game.steamReviewPercent != null && (
              <span className="badge badge-purple">{game.steamReviewPercent}% positive</span>
            )}
            {game.platforms.map((p) => (
              <span key={p.platformId} className="badge">
                {p.platform.name.toLowerCase()}
              </span>
            ))}
          </div>

          {game.summary && (
            <p className="mt-4 text-[hsl(var(--muted))] leading-relaxed">{game.summary}</p>
          )}

          {game.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {game.tags.map((t) => (
                <span key={t.tagId} className="badge">
                  {t.tag.name.toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SCREENSHOTS */}
      {game.screenshots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Screenshots</h2>
          <ScreenshotCarousel
            shots={game.screenshots.map((s) => ({
              imageUrl: s.imageUrl,
              thumbnailUrl: s.thumbnailUrl,
            }))}
          />
        </section>
      )}
    </div>
  );
}
