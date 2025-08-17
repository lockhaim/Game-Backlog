// app/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [games, tags, platforms] = await Promise.all([
    prisma.game.count(),
    prisma.tag.count(),
    prisma.platform.count(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Game Backlog</h1>
        <p className="text-sm text-gray-500">
          {games} games • {tags} tags • {platforms} platforms
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/games"
          className="rounded-2xl border p-6 hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold mb-2">Browse Library →</h2>
          <p className="text-sm text-gray-600">
            Filter by tags, platforms, search, and sort by recency or review %
          </p>
        </Link>

        <Link
          href="/import"
          className="rounded-2xl border p-6 hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold mb-2">Batch Import →</h2>
          <p className="text-sm text-gray-600">
            Paste Steam app IDs and run imports with concurrency controls
          </p>
        </Link>
      </section>

      <section className="rounded-2xl border p-6">
        <h3 className="text-lg font-semibold mb-2">Quick Owned Import</h3>
        <p className="text-sm text-gray-600 mb-4">
          Kick off an owned-games import directly (uses your Steam API key env).
        </p>
        <form
          action="/api/steam/owned"
          method="GET"
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Steam ID
            </label>
            <input
              name="steamId"
              placeholder="e.g. 7656119…"
              className="rounded border px-2 py-1 w-64"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Limit
            </label>
            <input
              name="limit"
              type="number"
              min={1}
              max={250}
              defaultValue={50}
              className="rounded border px-2 py-1 w-24"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-black text-white px-4 py-2"
          >
            Run Import
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-3">
          You’ll see a JSON summary in your browser.
        </p>
      </section>
    </main>
  );
}
