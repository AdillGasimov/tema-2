import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { StoreSettings } from "@prisma/client";
import { db } from "../../src/lib/db";
import { correctedHeroTitle, legacyHeroTitle, repairLegacyHeroTitle } from "../../src/lib/homepage-copy";

const run = randomUUID();
const marker = `test:homepage-owner:${run}`;
let original: StoreSettings;
beforeAll(async () => {
  original = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  await db.auditLog.create({ data: { id: marker, actorId: "test:homepage", action: "test.marker", entity: "Test", entityId: run, detail: {} } });
});
afterEach(() => db.storeSettings.update({ where: { id: "store" }, data: { heroTitle: original.heroTitle } }));
afterAll(() => db.$disconnect());

describe("scoped legacy headline repair", () => {
  it("repairs once under concurrency, audits only the headline and preserves later edits", async () => {
    const scope = { ownerMarker: marker, receiptId: `test:homepage-repair:${run}` };
    const before = await db.storeSettings.update({ where: { id: "store" }, data: { heroTitle: legacyHeroTitle } });
    const results = await Promise.all([repairLegacyHeroTitle(scope), repairLegacyHeroTitle(scope)]);
    expect(results.filter(r => r === "applied")).toHaveLength(1);
    const after = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
    expect(after.heroTitle).toBe(correctedHeroTitle);
    const unchanged = (s: StoreSettings) => Object.fromEntries(Object.entries(s).filter(([k]) => !["heroTitle", "updatedAt"].includes(k)));
    expect(unchanged(after)).toEqual(unchanged(before));
    expect(await db.auditLog.count({ where: { id: scope.receiptId, action: "settings.home-title" } })).toBe(1);
    await db.storeSettings.update({ where: { id: "store" }, data: { heroTitle: "Owner's newer headline" } });
    expect(await repairLegacyHeroTitle(scope)).toBe("already-applied");
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).heroTitle).toBe("Owner's newer headline");
  });
  it("skips other installations and preserves an owner's different headline", async () => {
    const scope = { ownerMarker: marker, receiptId: `test:homepage-preserve:${run}` };
    await db.storeSettings.update({ where: { id: "store" }, data: { heroTitle: legacyHeroTitle } });
    expect(await repairLegacyHeroTitle({ ...scope, ownerMarker: `absent:${run}` })).toBe("unmatched");
    await db.storeSettings.update({ where: { id: "store" }, data: { heroTitle: "Custom homepage" } });
    expect(await repairLegacyHeroTitle(scope)).toBe("preserved");
    expect((await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } })).heroTitle).toBe("Custom homepage");
    expect(await db.auditLog.findUnique({ where: { id: scope.receiptId } })).toBeNull();
  });
});
