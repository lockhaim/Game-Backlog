import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";

function buildWhere(q?: string | null) {
  if (!q) return {};
  return {
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { developerName: { contains: q, mode: "insensitive" } },
      { publisherName: { contains: q, mode: "insensitive" } },
    ],
  };
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams?: { q?: string; sort?: "recent" | "alpha" | "reviews" | "mc" };
}) {
  const q = searchParams?.q ?? "";
  const sort = searchParams?.sort ?? "recent";

  const orderBy =
    sort === "alpha"
      ? [{ title: "asc" as const }]
      : sort === "reviews"
      ? [{ steamReviewPercent: "desc" as const }, { steamReviewCount: "desc" as const }]
      : sort === "mc"
      ? [{ metacriticScore: "desc" as const }]
      : [{ updatedAt: "desc" as const }];

  const games = await prisma.game.findMany({
    where: buildWhere(q),
    orderBy,
    take: 60,
    include: {
      tags: { include: { tag: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <form className="flex flex-wrap items-center gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search titles, devs, publishers..."
          className="w-full md:w-80 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-700"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2"
        >
          <option value="recent">Recently updated</option>
          <option value="alpha">Alphabetical</option>
          <option value="reviews">Steam reviews</option>
          <option value="mc">Metacritic</option>
        </select>
        <button className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 hover:bg-neutral-800">
          Apply
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <GameCard
            key={g.id}
            slug={g.slug}
            title={g.title}
            headerImageUrl={g.headerImageUrl}
            steamReviewLabel={g.steamReviewLabel}
            steamReviewPercent={g.steamReviewPercent}
            metacriticScore={g.metacriticScore}
            tags={g.tags.map((t) => t.tag.name)}
          />
        ))}
      </div>
    </div>
  );
}
