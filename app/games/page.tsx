// app/games/page.tsx
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  tag?: string | string[];
  platform?: string | string[];
  sort?: "recent" | "reviews";
  page?: string;
  perPage?: string;
};

function toArray(v?: string | string[] | null): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const q = (searchParams.q || "").trim();
  const tags = toArray(searchParams.tag);
  const platforms = toArray(searchParams.platform);
  const sort = (searchParams.sort as "recent" | "reviews") || "recent";

  const page = Math.max(1, parseInt(searchParams.page || "1", 10));
  const perPage = Math.min(48, Math.max(1, parseInt(searchParams.perPage || "24", 10)));
  const skip = (page - 1) * perPage;

  const where = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { summary: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
      tags.length
        ? {
            tags: {
              some: {
                tag: {
                  name: { in: tags, mode: "insensitive" as const },
                },
              },
            },
          }
        : {},
      platforms.length
        ? {
            platforms: {
              some: {
                platform: {
                  name: { in: platforms, mode: "insensitive" as const },
                },
              },
            },
          }
        : {},
    ],
  };

  const orderBy =
    sort === "reviews"
      ? [{ steamReviewPercent: "desc" as const }, { updatedAt: "desc" as const }]
      : [{ updatedAt: "desc" as const }];

  const [allTags, allPlatforms, total, rows] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.platform.findMany({ orderBy: { name: "asc" } }),
    prisma.game.count({ where }),
    prisma.game.findMany({
      where,
      include: {
        tags: { include: { tag: true } },
        platforms: { include: { platform: true } },
      },
      orderBy,
      skip,
      take: perPage,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Library</h1>
        <Link
          href="/"
          className="text-sm text-gray-600 underline underline-offset-4"
        >
          ← Home
        </Link>
      </header>

      <form className="rounded-2xl border p-4 grid gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grow min-w-[220px]">
            <label className="block text-xs font-medium mb-1">Search</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="Title or summary…"
              className="w-full rounded border px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Sort</label>
            <select
              name="sort"
              defaultValue={sort}
              className="rounded border px-2 py-1"
            >
              <option value="recent">Most recently updated</option>
              <option value="reviews">Highest review %</option>
            </select>
          </div>
          <button className="rounded bg-black text-white px-4 py-2">
            Apply
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="rounded border p-3">
            <legend className="text-xs font-medium px-1">Tags</legend>
            <div className="max-h-40 overflow-auto grid grid-cols-2 gap-y-1 text-sm">
              {allTags.map((t) => {
                const checked = tags.some(
                  (x) => x.toLowerCase() === t.name.toLowerCase()
                );
                return (
                  <label key={t.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="tag"
                      value={t.name}
                      defaultChecked={checked}
                    />
                    {t.name}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="rounded border p-3">
            <legend className="text-xs font-medium px-1">Platforms</legend>
            <div className="max-h-40 overflow-auto grid grid-cols-2 gap-y-1 text-sm">
              {allPlatforms.map((p) => {
                const checked = platforms.some(
                  (x) => x.toLowerCase() === p.name.toLowerCase()
                );
                return (
                  <label key={p.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="platform"
                      value={p.name}
                      defaultChecked={checked}
                    />
                    {p.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
      </form>

      <section>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-600">No games match your filters.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((g) => (
              <GameCard
                key={g.id}
                game={{
                  slug: g.slug,
                  title: g.title,
                  headerImageUrl: g.headerImageUrl || null,
                  reviewPercent: g.steamReviewPercent ?? null,
                  tags: g.tags.map((x) => x.tag.name),
                  platforms: g.platforms.map((x) => x.platform.name),
                }}
              />
            ))}
          </div>
        )}
      </section>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2">
          {Array.from({ length: pages }).map((_, i) => {
            const n = i + 1;
            const usp = new URLSearchParams();
            if (q) usp.set("q", q);
            tags.forEach((t) => usp.append("tag", t));
            platforms.forEach((p) => usp.append("platform", p));
            usp.set("sort", sort);
            usp.set("page", String(n));
            usp.set("perPage", String(perPage));
            return (
              <a
                key={n}
                href={`?${usp.toString()}`}
                className={`rounded px-3 py-1 text-sm border ${
                  n === page ? "bg-black text-white" : "hover:bg-gray-50"
                }`}
              >
                {n}
              </a>
            );
          })}
        </nav>
      )}
    </main>
  );
}