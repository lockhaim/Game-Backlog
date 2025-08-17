// app/games/[slug]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GameDetail({
  params,
}: {
  params: { slug: string };
}) {
  const game = await prisma.game.findUnique({
    where: { slug: params.slug },
    include: {
      screenshots: { orderBy: { sortIndex: "asc" } },
      tags: { include: { tag: true } },
      platforms: { include: { platform: true } },
    },
  });

  if (!game) return notFound();

  const tagNames = game.tags.map((t) => t.tag.name);
  const platformNames = game.platforms.map((p) => p.platform.name);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <Link href="/games" className="text-sm text-gray-600 underline">
        ← Back to Library
      </Link>

      <header className="flex items-start gap-4">
        {game.headerImageUrl && (
          <div className="relative w-[460px] h-[215px] hidden sm:block">
            <Image
              src={game.headerImageUrl}
              alt={game.title}
              fill
              className="object-cover rounded"
              sizes="460px"
              priority
            />
          </div>
        )}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{game.title}</h1>
          {game.steamReviewPercent != null && (
            <p className="text-sm text-gray-600">
              Steam Reviews: <strong>{game.steamReviewPercent}%</strong>{" "}
              {game.steamReviewLabel ? `· ${game.steamReviewLabel}` : ""}
              {game.steamReviewCount ? ` · ${game.steamReviewCount.toLocaleString()} reviews` : ""}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {platformNames.map((p) => (
              <span key={p} className="rounded bg-gray-100 px-2 py-0.5">
                {p}
              </span>
            ))}
            {tagNames.map((t) => (
              <span
                key={t}
                className="rounded bg-gray-100 px-2 py-0.5 border border-gray-200"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </header>

      {game.summary && (
        <section className="prose max-w-none">
          <p className="text-gray-800">{game.summary}</p>
        </section>
      )}

      {game.screenshots.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Screenshots</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {game.screenshots.map((s) => (
              <div key={s.id} className="relative aspect-video">
                <Image
                  src={s.imageUrl}
                  alt=""
                  fill
                  className="object-cover rounded"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
