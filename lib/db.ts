import { PrismaClient } from "@/app/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * Lazy Prisma client. The actual client is created on first method access,
 * not on module import. This prevents `next build` from opening N database
 * connections from N route worker processes simultaneously, which causes
 * SQLite lock deadlocks.
 */

let _client: PrismaClient | null = null;

function getClient(): PrismaClient {
  if (_client) return _client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Ensure .env.local or Electron config provides it."
    );
  }
  const adapter = new PrismaBetterSqlite3({ url });
  _client = new PrismaClient({ adapter });
  return _client;
}

const globalForPrisma = globalThis as unknown as { prismaProxy?: PrismaClient };

function buildProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      const client = getClient() as unknown as Record<string | symbol, unknown>;
      const value = client[prop as string | symbol];
      if (typeof value === "function") {
        return (value as (...args: unknown[]) => unknown).bind(client);
      }
      return value;
    },
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prismaProxy ?? buildProxy();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaProxy = prisma;
}
