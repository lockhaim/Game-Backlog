// app/games/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";

type PageProps = {
  searchParams?: {
    q?: string;
    platform?: string;
    tag?: string;
    sort?: string;
    page?: string;
  };
};

const PAGE_SIZE = 24;

function toInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function GamesPage({ searchParams }: PageProps) {
  const q = (searchParams?.q ?? "").trim();
  const platform = (searchParams?.platform ?? "").trim();
  const tag = (searchParams?.tag ?? "").trim();
  const sort = (searchParams?.sort ?? "recent").trim();
  const page = toInt(searchParams?.page, 1);

  // Build Prisma where
  const where: any = {};
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }
  if (platform) {
    where.platforms = {
      some: { platform: { name: { equals: platform, mode: "insensitive" } } },
    };
  }
  if (tag) {
    where.tags = {
      some: { tag: { name: { equals: tag, mode: "insensitive" } } },
    };
  }

  // Sort
  let orderBy: any = [{ createdAt: "desc" as const }];
  if (sort === "recent") {
    orderBy = [{ releaseDate: "desc" as const }, { createdAt: "desc" as const }];
  } else if (sort === "reviews") {
    orderBy = [
      { steamReviewPercent: "desc" as const },
      { steamReviewCount: "desc" as const },
      { title: "asc" as const },
    ];
  } else if (sort === "title") {
    orderBy = [{ title: "asc" as const }];
  }

  const skip = (page - 1) * PAGE_SIZE;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip,
      include: {
        tags: { include: { tag: true } },
        platforms: { include: { platform: true } },
      },
    }),
    prisma.game.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* Tiny debug banner so you know the query returned something */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-300">
        <span className="font-medium">Debug:</span>{" "}
        {games.length} shown, total matching = {total}
      </div>

      <h1 className="text-2xl font-semibold">Games</h1>

      {/* Filters */}
      <form className="grid gap-3 md:grid-cols-4 items-end" action="/games" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-sm text-zinc-400">Search</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Title or summary…"
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="platform" className="text-sm text-zinc-400">Platform</label>
          <select
            id="platform"
            name="platform"
            defaultValue={platform}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
          >
            <option value="">All</option>
            <option value="Windows">Windows</option>
            <option value="Mac">Mac</option>
            <option value="Linux">Linux</option>
            <option value="PC">PC</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tag" className="text-sm text-zinc-400">Tag</label>
          <input
            id="tag"
            name="tag"
            defaultValue={tag}
            placeholder='e.g. "Action"'
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
            list="tag-hints"
          />
          <datalist id="tag-hints">
            <option value="Action" />
            <option value="RPG" />
            <option value="Strategy" />
            <option value="Adventure" />
            <option value="Indie" />
          </datalist>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-sm text-zinc-400">Sort</label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
          >
            <option value="recent">Newest release</option>
            <option value="reviews">Best reviews</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        <input type="hidden" name="page" value="1" />
        <div className="md:col-span-4">
          <button
            type="submit"
            className="mt-2 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
          >
            Apply
          </button>
        </div>
      </form>

      {games.length === 0 ? (
        <p className="text-zinc-400">No games match those filters.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-400">
            Showing {(skip + 1).toLocaleString()}–
            {Math.min(skip + PAGE_SIZE, total).toLocaleString()} of{" "}
            {total.toLocaleString()}
          </p>

          {/* 1/2/3/4 columns responsive */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((g) => (
              <GameCard
                key={g.id}
                title={g.title}
                slug={g.slug}
                headerImageUrl={g.headerImageUrl ?? null}
                metacriticScore={g.metacriticScore ?? null}
                steamReviewPercent={g.steamReviewPercent ?? null}
                tags={g.tags.map((t) => t.tag.name)}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <PageLink label="« Prev" page={Math.max(1, page - 1)} disabled={page <= 1} q={q} platform={platform} tag={tag} sort={sort} />
            <span className="text-sm text-zinc-400">
              Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </span>
            <PageLink label="Next »" page={Math.min(Math.max(1, Math.ceil(total / PAGE_SIZE)), page + 1)} disabled={page >= Math.max(1, Math.ceil(total / PAGE_SIZE))} q={q} platform={platform} tag={tag} sort={sort} />
          </div>
        </>
      )}
    </div>
  );
}

function PageLink({
  label,
  page,
  disabled,
  q,
  platform,
  tag,
  sort,
}: {
  label: string;
  page: number;
  disabled?: boolean;
  q: string;
  platform: string;
  tag: string;
  sort: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (platform) params.set("platform", platform);
  if (tag) params.set("tag", tag);
  if (sort) params.set("sort", sort);
  params.set("page", String(page));

  if (disabled) {
    return (
      <span className="rounded-md border border-zinc-800 px-3 py-1 text-zinc-500">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/games?${params.toString()}`}
      className="rounded-md border border-zinc-800 px-3 py-1 text-zinc-200 hover:bg-zinc-900"
    >
      {label}
    </Link>
  );
}
