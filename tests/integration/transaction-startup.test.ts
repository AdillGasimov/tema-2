import { afterAll, describe, expect, it, vi } from "vitest";
import { db, transaction } from "../../src/lib/db";

afterAll(async () => { vi.unstubAllEnvs(); await db.$disconnect(); });

describe("bounded deployment transaction acquisition", () => {
  it("waits for an occupied single-connection pool without running the transaction twice", async () => {
    vi.stubEnv("DEPLOYMENT_DB_PREPARATION", "1");
    let entered = 0;
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>(resolve => { locked = resolve; });
    const unblock = new Promise<void>(resolve => { release = resolve; });
    const blocker = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1`;
      locked(); await unblock;
    }, { timeout: 10000 });
    await held;
    const waiting = transaction(async tx => { entered++; return tx.$queryRaw`SELECT 42 AS value`; });
    const timer = setTimeout(release, 2500);
    try {
      expect(await waiting).toEqual([{ value: 42 }]);
      expect(entered).toBe(1);
    } finally { clearTimeout(timer); release(); await blocker; vi.unstubAllEnvs(); }
  });
  it("retains the ordinary runtime wait limit when the deployment marker is absent", async () => {
    vi.stubEnv("DEPLOYMENT_DB_PREPARATION", "");
    let entered = 0;
    let release!: () => void;
    let locked!: () => void;
    const held = new Promise<void>(resolve => { locked = resolve; });
    const unblock = new Promise<void>(resolve => { release = resolve; });
    const blocker = db.$transaction(async tx => { await tx.$queryRaw`SELECT 1`; locked(); await unblock; }, { timeout: 10000 });
    await held;
    const timer = setTimeout(release, 2500);
    try {
      await expect(transaction(async () => { entered++; })).rejects.toMatchObject({ code: "P2028" });
      expect(entered).toBe(0);
    } finally { clearTimeout(timer); release(); await blocker; vi.unstubAllEnvs(); }
  });
});
