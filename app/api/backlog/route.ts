export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBacklogSchema, currentUserId } from "../_utils";

export async function GET(req: Request) {
  try {
    const userId = await currentUserId();

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as any | null;
    const qStatus = status ? { status } : undefined;

    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.backlogEntry.findMany({
        where: { userId, ...(qStatus ? qStatus : {}) },
        include: {
          game: {
            select: {
              id: true, slug: true, title: true, headerImageUrl: true,
              steamReviewPercent: true, steamReviewCount: true, releaseDate: true,
              tags: { include: { tag: true } },
              platforms: { include: { platform: true } },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        skip, take: pageSize,
      }),
      prisma.backlogEntry.count({ where: { userId, ...(qStatus ? qStatus : {}) } }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const status = /Not authenticated/i.test(msg) ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Not authenticated" : msg }, { status });
  }
}
