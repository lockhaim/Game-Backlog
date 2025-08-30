import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateBacklogSchema, currentUserId } from "../../_utils";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  const item = await prisma.backlogEntry.findFirst({
    where: { id: params.id, userId },
    include: { game: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();
  const body = await req.json();
  const parsed = updateBacklogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const updated = await prisma.backlogEntry.updateMany({
    where: { id: params.id, userId },
    data,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = await prisma.backlogEntry.findUnique({ where: { id: params.id }, include: { game: true } });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await currentUserId();

  const deleted = await prisma.backlogEntry.deleteMany({
    where: { id: params.id, userId },
  });
  if (deleted.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
