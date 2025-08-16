// app/api/steam/import/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fetchAppDetails, fetchReviewSummary } from "@/lib/steam";
import {
  normalizeGame,
  normalizeScreenshots,
  normalizeTags,
  normalizePlatforms,
} from "@/lib/normalizers";

/**
 * GET /api/steam/import?appId=570
 * Imports a Steam app into your database:
 *  - Upserts Game by steamAppId
 *  - Replaces Screenshot rows (ordered)
 *  - Upserts Tag/Platform and links via join tables
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const appIdStr = searchParams.get("appId");

    if (!appIdStr || !/^\d+$/.test(appIdStr)) {
      return NextResponse.json(
        { error: "Missing or invalid appId (expected integer)" },
        { status: 400 }
      );
    }
    const appId = Number(appIdStr);

    // 1) Fetch from Steam
    const [details, reviewSummary] = await Promise.all([
      fetchAppDetails(appId),
      fetchReviewSummary(appId).catch(() => null),
    ]);

    // 2) Normalize for DB
    const gameData = normalizeGame(appId, details, reviewSummary);
    const screenshots = normalizeScreenshots(details);
    const tagNames = normalizeTags(details);
    const platformNames = normalizePlatforms(details);

    // 3) Persist in a transaction for consistency
    const result = await prisma.$transaction(async (tx) => {
      // a) Upsert Game by steamAppId
      const game = await tx.game.upsert({
        where: { steamAppId: gameData.steamAppId },
        create: {
          steamAppId: gameData.steamAppId,
          title: gameData.title,
          slug: gameData.slug,
          summary: gameData.summary,
          headerImageUrl: gameData.headerImageUrl,
          heroCapsuleUrl: gameData.heroCapsuleUrl,
          developerName: gameData.developerName,
          publisherName: gameData.publisherName,
          releaseDate: gameData.releaseDate ? new Date(gameData.releaseDate) : null,
          metacriticScore: gameData.metacriticScore,
          steamReviewPercent: gameData.steamReviewPercent,
          steamReviewCount: gameData.steamReviewCount,
          steamReviewLabel: gameData.steamReviewLabel,
        },
        update: {
          title: gameData.title,
          slug: gameData.slug,
          summary: gameData.summary,
          headerImageUrl: gameData.headerImageUrl,
          heroCapsuleUrl: gameData.heroCapsuleUrl,
          developerName: gameData.developerName,
          publisherName: gameData.publisherName,
          releaseDate: gameData.releaseDate ? new Date(gameData.releaseDate) : null,
          metacriticScore: gameData.metacriticScore,
          steamReviewPercent: gameData.steamReviewPercent,
          steamReviewCount: gameData.steamReviewCount,
          steamReviewLabel: gameData.steamReviewLabel,
        },
      });

      // b) Replace Screenshots for this game
      await tx.screenshot.deleteMany({ where: { gameId: game.id } });
      if (screenshots.length) {
        await tx.screenshot.createMany({
          data: screenshots.map((s) => ({
            gameId: game.id,
            imageUrl: s.imageUrl,
            thumbnailUrl: s.thumbnailUrl,
            sortIndex: s.sortIndex,
          })),
          skipDuplicates: true,
        });
      }

      // c) Upsert Tags, then link via GameTag
      const tagIds: string[] = [];
      for (const name of tagNames) {
        const tag = await tx.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        tagIds.push(tag.id);
      }
      if (tagIds.length) {
        // Create join rows, skipping duplicates thanks to @@unique([gameId, tagId])
        await tx.gameTag.createMany({
          data: tagIds.map((tagId) => ({ gameId: game.id, tagId })),
          skipDuplicates: true,
        });
      }

      // d) Upsert Platforms, then link via GamePlatform
      const platformIds: string[] = [];
      for (const name of platformNames) {
        const platform = await tx.platform.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        platformIds.push(platform.id);
      }
      if (platformIds.length) {
        await tx.gamePlatform.createMany({
          data: platformIds.map((platformId) => ({ gameId: game.id, platformId })),
          skipDuplicates: true,
        });
      }

      // e) Return the game with a lightweight include
      const withChildren = await tx.game.findUnique({
        where: { id: game.id },
        include: {
          screenshots: { orderBy: { sortIndex: "asc" } },
          tags: { include: { tag: true } },
          platforms: { include: { platform: true } },
        },
      });

      return withChildren;
    });

    return NextResponse.json(result ?? {}, { status: 200 });
  } catch (err: any) {
    console.error("Steam import error:", err);
    return NextResponse.json(
      { error: "Import failed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
