import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "../../_utils";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  const now = new Date();
  const updated = await prisma.backlogEntry.updateMany({
    where: { id: params.id, userId },
    data: { status: "PLAYING", startedAt: now, lastSessionAt: now },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
