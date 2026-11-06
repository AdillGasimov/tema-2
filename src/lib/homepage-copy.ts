import { transaction } from "./db";

// A text input removed the newline from this original headline on settings save.
// Repair only that exact legacy value on the owner's already branded installation.
export const legacyHeroTitle = "Hər detaldamükəmməl qayğı.";
export const correctedHeroTitle = "Hər detalda\nmükəmməl qayğı.";
export async function repairLegacyHeroTitle(scope = {
  ownerMarker: "brand-release:owner-furycar-brand-2026-11-06",
  receiptId: "homepage-copy:owner-furycar-2026-11-06",
}) {
  return transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(873194634)`;
    if (await tx.auditLog.findUnique({ where: { id: scope.receiptId } })) return "already-applied";
    if (!await tx.auditLog.findUnique({ where: { id: scope.ownerMarker } })) return "unmatched";
    const current = await tx.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
    if (current.heroTitle !== legacyHeroTitle) return "preserved";
    await tx.storeSettings.update({ where: { id: "store" }, data: { heroTitle: correctedHeroTitle } });
    await tx.auditLog.create({ data: { id: scope.receiptId, actorId: "system:homepage-copy", action: "settings.home-title", entity: "StoreSettings", entityId: "store",
      detail: { before: { heroTitle: current.heroTitle }, after: { heroTitle: correctedHeroTitle } } } });
    return "applied";
  });
}
