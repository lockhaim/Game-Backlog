import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const games = await prisma.game.findMany();
  return NextResponse.json(games);
}
