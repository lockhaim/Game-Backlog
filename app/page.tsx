// app/games/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import GameCard from "@/components/GameCard";

type SearchParams = {
  q?: string;
  platform?: string;
  tag?: string;
  sort?: string;  // "recent" | "reviews" | "title" | "recently-played" | "most-played"
  page?: string;
};

const PAGE_SIZE = 24;

function toInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const q = (sp?.q ?? "").trim();
  const platform = (sp?.platform ?? "").trim();
  const tag = (sp?.tag ?? "").trim();
  const sort = (sp?.sort ?? "recent").trim();
  const page = toInt(sp?.page, 1);

  // where
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
    where.tags = { some: { tag: { name: { equals: tag, mode: "insensitive" } } } };
  }

  // orderBy (no preview features)
  let orderBy: any[] = [{ createdAt: "desc" as const }];

  switch (sort) {
    case "recent":
      orderBy = [{ releaseDate: "desc" as const }, { createdAt: "desc" as const }];
      break;
    case "reviews":
      orderBy = [
        { steamReviewPercent: "desc" as const },
        { steamReviewCount: "desc" as const },
        { title: "asc" as const },
      ];
      break;
    case "title":
      orderBy = [{ title: "asc" as const }];
      break;
    case "recently-played":
      // Ensure we only show games that have lastPlayedAt so sorting makes sense
      where.lastPlayedAt = { not: null };
      orderBy = [
        { lastPlayedAt: "desc" as const },
        { playtimeMinutes: "desc" as const },
        { releaseDate: "desc" as const },
        { title: "asc" as const },
      ];
      break;
    case "most-played":
      // Only games with playtime; avoids NULLs at the top
      where.playtimeMinutes = { not: null };
      orderBy = [
        { playtimeMinutes: "desc" as const },
        { lastPlayedAt: "desc" as const },
        { title: "asc" as const },
      ];
      break;
  }

  const skip = (page - 1) * PAGE_SIZE;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip,
      select: {
        id: true,
        title: true,
        slug: true,
        headerImageUrl: true,
        metacriticScore: true,
        steamReviewPercent: true,
        playtimeMinutes: true,
        lastPlayedAt: true,
        tags: { select: { tag: { select: { name: true } } } },
        platforms: { select: { platform: { select: { name: true } } } },
      },
    }),
    prisma.game.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Library</h1>
        <p className="text-sm text-muted-foreground">
          Showing {(skip + 1).toLocaleString()}–
          {Math.min(skip + PAGE_SIZE, total).toLocaleString()} of{" "}
          {total.toLocaleString()}
        </p>
      </div>

      {/* Filters */}
      <form className="grid gap-3 md:grid-cols-4 items-end" action="/games" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-sm text-muted-foreground">Search</label>
          <input id="q" name="q" defaultValue={q} placeholder="Title or summary…" className="rounded-lg border bg-background px-3 py-2" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="platform" className="text-sm text-muted-foreground">Platform</label>
          <select id="platform" name="platform" defaultValue={platform} className="rounded-lg border bg-background px-3 py-2">
            <option value="">All</option>
            <option value="Windows">Windows</option>
            <option value="Mac">Mac</option>
            <option value="Linux">Linux</option>
            <option value="PC">PC</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="tag" className="text-sm text-muted-foreground">Tag</label>
          <input id="tag" name="tag" defaultValue={tag} placeholder='e.g. "Action"' className="rounded-lg border bg-background px-3 py-2" list="tag-hints" />
          <datalist id="tag-hints">
            <option value="Action" />
            <option value="RPG" />
            <option value="Strategy" />
            <option value="Adventure" />
            <option value="Indie" />
          </datalist>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-sm text-muted-foreground">Sort</label>
          <select id="sort" name="sort" defaultValue={sort} className="rounded-lg border bg-background px-3 py-2">
            <option value="recent">Newest release</option>
            <option value="reviews">Best reviews</option>
            <option value="title">Title A–Z</option>
            <option value="recently-played">Recently played</option>
            <option value="most-played">Most played</option>
          </select>
        </div>

        <input type="hidden" name="page" value="1" />
        <div className="md:col-span-4">
          <button type="submit" className="mt-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90">
            Apply
          </button>
        </div>
      </form>

      {games.length === 0 ? (
        <p className="text-muted-foreground">No games match those filters.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((g) => (
              <GameCard
                key={g.id}
                title={g.title}
                slug={g.slug}
                headerImageUrl={g.headerImageUrl ?? null}
                metacriticScore={g.metacriticScore ?? null}
                steamReviewPercent={g.steamReviewPercent ?? null}
                tags={g.tags.map((t) => t.tag.name)}
                lastPlayedAt={g.lastPlayedAt ?? null}
                playtimeMinutes={g.playtimeMinutes ?? null}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            <PageLink label="« Prev" page={Math.max(1, page - 1)} disabled={page <= 1} q={q} platform={platform} tag={tag} sort={sort} />
            <span className="text-sm text-muted-foreground">Page {page} / {totalPages}</span>
            <PageLink label="Next »" page={Math.min(totalPages, page + 1)} disabled={page >= totalPages} q={q} platform={platform} tag={tag} sort={sort} />
          </div>
        </>
      )}
    </div>
  );
}

function PageLink({
  label, page, disabled, q, platform, tag, sort,
}: {
  label: string; page: number; disabled?: boolean; q: string; platform: string; tag: string; sort: string;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (platform) params.set("platform", platform);
  if (tag) params.set("tag", tag);
  if (sort) params.set("sort", sort);
  params.set("page", String(page));

  if (disabled) {
    return <span className="rounded-lg border px-3 py-1 text-muted-foreground border-border">{label}</span>;
  }
  return (
    <Link href={`/games?${params.toString()}`} className="rounded-lg border px-3 py-1 hover:bg-accent hover:text-accent-foreground border-border">
      {label}
    </Link>
  );
}
