// app/games/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";

type PageProps = {
  searchParams?: {
    q?: string;
    platform?: string; // "Windows" | "Mac" | "Linux" | "PC"
    tag?: string;      // exact tag name, e.g. "Action"
    sort?: string;     // "recent" | "reviews" | "title"
    page?: string;     // "1", "2", ...
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

  // Build Prisma "where" dynamically
  const where: any = {};

  // Free-text search across title/summary
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }

  // Filter by platform name (GamePlatform -> Platform.name)
  if (platform) {
    where.platforms = {
      some: { platform: { name: { equals: platform, mode: "insensitive" } } },
    };
  }

  // Filter by tag name (GameTag -> Tag.name)
  if (tag) {
    where.tags = {
      some: { tag: { name: { equals: tag, mode: "insensitive" } } },
    };
  }

  // Sorting
  let orderBy: any = [{ createdAt: "desc" as const }]; // default fallback
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
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Games</h1>

      {/* Filters bar */}
      <form
        className="grid gap-3 md:grid-cols-4 items-end"
        action="/games"
        method="get"
      >
        {/* Search */}
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-sm text-gray-600">Search</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Title or summary…"
            className="rounded-md border px-3 py-2"
          />
        </div>

        {/* Platform */}
        <div className="flex flex-col gap-1">
          <label htmlFor="platform" className="text-sm text-gray-600">Platform</label>
          <select
            id="platform"
            name="platform"
            defaultValue={platform}
            className="rounded-md border px-3 py-2"
          >
            <option value="">All</option>
            <option value="Windows">Windows</option>
            <option value="Mac">Mac</option>
            <option value="Linux">Linux</option>
            <option value="PC">PC</option>
          </select>
        </div>

        {/* Tag */}
        <div className="flex flex-col gap-1">
          <label htmlFor="tag" className="text-sm text-gray-600">Tag</label>
          <input
            id="tag"
            name="tag"
            defaultValue={tag}
            placeholder='e.g. "Action"'
            className="rounded-md border px-3 py-2"
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

        {/* Sort */}
        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-sm text-gray-600">Sort</label>
          <select
            id="sort"
            name="sort"
            defaultValue={sort}
            className="rounded-md border px-3 py-2"
          >
            <option value="recent">Newest release</option>
            <option value="reviews">Best reviews</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        {/* Keep page=1 on submit */}
        <input type="hidden" name="page" value="1" />
        <div className="md:col-span-4">
          <button
            type="submit"
            className="mt-2 rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800"
          >
            Apply
          </button>
        </div>
      </form>

      {/* Results */}
      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-gray-500">
          No games match those filters.
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Showing {(skip + 1).toLocaleString()}–
            {Math.min(skip + PAGE_SIZE, total).toLocaleString()} of{" "}
            {total.toLocaleString()}
          </p>

          {/* Auto-fit grid: will display ~3–4 cards per row on typical screens */}
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {games.map((g) => (
              <GameCard
                key={g.id}
                title={g.title}
                slug={g.slug}
                headerImageUrl={g.headerImageUrl ?? null}
                metacriticScore={g.metacriticScore ?? null}
                steamReviewPercent={g.steamReviewPercent ?? null}
                tags={g.tags.map((t) => t.tag.name)}
                platforms={g.platforms.map((p) => p.platform.name)}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <PageLink
              label="« Prev"
              page={Math.max(1, page - 1)}
              disabled={page <= 1}
              q={q}
              platform={platform}
              tag={tag}
              sort={sort}
            />
            <span className="text-sm text-gray-700">
              Page {page} / {totalPages}
            </span>
            <PageLink
              label="Next »"
              page={Math.min(totalPages, page + 1)}
              disabled={page >= totalPages}
              q={q}
              platform={platform}
              tag={tag}
              sort={sort}
            />
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
      <span className="rounded-md border px-3 py-1 text-gray-400 border-gray-200">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={`/games?${params.toString()}`}
      className="rounded-md border px-3 py-1 hover:bg-gray-50 border-gray-200"
    >
      {label}
    </Link>
  );
}
