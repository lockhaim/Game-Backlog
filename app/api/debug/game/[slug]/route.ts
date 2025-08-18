// app/api/debug/game/[slug]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  const game = await prisma.game.findUnique({
    where: { slug },
    include: {
      screenshots: { orderBy: { sortIndex: "asc" } },
      tags: { include: { tag: true } },
      platforms: { include: { platform: true } },
    },
  });

  if (!game) {
    return NextResponse.json({ ok: false, error: "GAME_NOT_FOUND", slug }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    id: game.id,
    steamAppId: game.steamAppId,
    title: game.title,
    slug: game.slug,
    headerImageUrl: game.headerImageUrl,
    screenshotsCount: game.screenshots.length,
    screenshots: game.screenshots.map(s => ({
      id: s.id,
      sortIndex: s.sortIndex,
      imageUrl: s.imageUrl,
      thumbnailUrl: s.thumbnailUrl,
    })),
    tags: game.tags.map(t => t.tag.name),
    platforms: game.platforms.map(p => p.platform.name),
  });
}
