import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databasePoolConfig } from "./db-config";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient({ adapter: new PrismaPg(databasePoolConfig()), log: ["error"] });
// Route bundles can load this module separately in the same production worker.
// Reuse its client there too, rather than opening a fresh pool for every bundle.
globalDb.prisma = db;
export type Tx = Prisma.TransactionClient;
function serializationConflict(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 3) return false;
  const e = error as { code?: unknown; originalCode?: unknown; kind?: unknown; cause?: unknown };
  return e.code === "P2034" || e.code === "40001" || e.originalCode === "40001" || e.originalCode === "40P01" || e.kind === "TransactionWriteConflict" || (e.cause !== error && serializationConflict(e.cause, depth + 1));
}
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await db.$transaction(fn, { isolationLevel: "Serializable", timeout: 20000 }); }
    catch (error) {
      if (!serializationConflict(error) || attempt === 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1) + Math.floor(Math.random() * 25)));
    }
  }
  throw new Error("Transaction retries exhausted");
}
