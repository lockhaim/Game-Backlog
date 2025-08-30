// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Keep a single client across HMR in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// In dev, prefer DIRECT_URL (non-pooled) for faster local queries.
// In prod, leave DATABASE_URL (pooled) alone.
if (process.env.NODE_ENV !== "production" && process.env.DIRECT_URL) {
  // Safe to set before instantiation; Prisma reads env at construction time.
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // keep logs light by default; add "query" when debugging
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
