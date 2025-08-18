// app/games/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";

type PageProps = {
  searchParams?: {
    q?: string;
    platform?: string; // "Windows" | "Mac" | "Linux" | "PC"
    tag?: string;      // exact tag name (e.g., "Action")
    sort?: string;     // "recent" | "reviews" | "title"
    page?: string;     // "1", "2", ...
    withShots?: string; // "on" when checked
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
  const withShots = (searchParams?.withShots ?? "") === "on";

  // Build Prisma "where" dynamically
  const where: any = {};

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
    ];
  }

  if (platform) {
    const normalized = platform.toLowerCase() === "pc" ? "windows" : platform;
    where.platforms = {
      some: { platform: { name: { equals: normalized, mode: "insensitive" } } },
    };
  }

  if (tag) {
    where.tags = {
      some: { tag: { name: { equals: tag, mode: "insensitive" } } },
    };
  }

  if (withShots) {
    where.screenshots = { some: {} };
  }

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
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Games</h1>
        <Link
          href="/admin/import"
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 border-gray-200"
        >
          Open Import UI
        </Link>
      </div>

      {/* Filters bar */}
      <form className="grid gap-3 md:grid-cols-4 items-end" action="/games" method="get">
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

        <div className="flex flex-col gap-1">
          <label htmlFor="platform" className="text-sm text-gray-600">Platform</label>
          <select id="platform" name="platform" defaultValue={platform} className="rounded-md border px-3 py-2">
            <option value="">All</option>
            <option value="Windows">Windows</option>
            <option value="Mac">Mac</option>
            <option value="Linux">Linux</option>
            <option value="PC">PC</option>
          </select>
        </div>

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

        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-sm text-gray-600">Sort</label>
          <select id="sort" name="sort" defaultValue={sort} className="rounded-md border px-3 py-2">
            <option value="recent">Newest release</option>
            <option value="reviews">Best reviews</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        <div className="flex items-center gap-2 md:col-span-4">
          <input
            id="withShots"
            name="withShots"
            type="checkbox"
            defaultChecked={withShots}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="withShots" className="text-sm text-gray-700">
            Only show games with screenshots
          </label>
        </div>

        <input type="hidden" name="page" value="1" />
        <div className="md:col-span-4">
          <button type="submit" className="mt-2 rounded-md bg-black px-4 py-2 text-white hover:bg-gray-800">
            Apply
          </button>
          <Link href="/games" className="ml-2 text-sm text-gray-600 hover:underline">
            Reset
          </Link>
        </div>
      </form>

      {games.length === 0 ? (
        <p className="text-gray-600">No games match those filters.</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Showing {(skip + 1).toLocaleString()}–
            {Math.min(skip + PAGE_SIZE, total).toLocaleString()} of {total.toLocaleString()}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <GameCard
                key={g.id}
                game={{
                  title: g.title,
                  slug: g.slug,
                  headerImageUrl: g.headerImageUrl ?? null,
                  metacriticScore: g.metacriticScore ?? null,
                  steamReviewPercent: g.steamReviewPercent ?? null,
                  tags: g.tags.map((t) => t.tag.name),
                }}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <PageLink
              label="« Prev"
              page={Math.max(1, page - 1)}
              disabled={page <= 1}
              q={q}
              platform={platform}
              tag={tag}
              sort={sort}
              withShots={withShots}
            />
            <span className="text-sm text-gray-700">
              Page {page} / {Math.max(1, totalPages)}
            </span>
            <PageLink
              label="Next »"
              page={Math.min(totalPages, page + 1)}
              disabled={page >= totalPages}
              q={q}
              platform={platform}
              tag={tag}
              sort={sort}
              withShots={withShots}
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
  withShots,
}: {
  label: string;
  page: number;
  disabled?: boolean;
  q: string;
  platform: string;
  tag: string;
  sort: string;
  withShots: boolean;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (platform) params.set("platform", platform);
  if (tag) params.set("tag", tag);
  if (sort) params.set("sort", sort);
  if (withShots) params.set("withShots", "on");
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
