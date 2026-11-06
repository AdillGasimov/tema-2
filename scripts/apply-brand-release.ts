import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import { AppError } from "../src/lib/errors";
import { applyBrandRelease, brandReleaseSchema, inspectBrandRelease } from "../src/lib/brand-release";
import { uploadImage, deleteImage } from "../src/lib/storage";

async function main() {
  const directory = new URL("../branding/furycar/", import.meta.url);
  const plan = brandReleaseSchema.parse(JSON.parse(await readFile(new URL("release.json", directory), "utf8")));
  const status = await inspectBrandRelease(plan);
  if (status !== "ready") { console.log(`Owner brand release: ${status}; no changes.`); return; }
  const assets = await Promise.all([plan.logo, plan.favicon].map(async asset => {
    const bytes = await readFile(new URL(asset.file, directory));
    if (bytes.length > 4 * 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new AppError("Brand asset checksum/size mismatch.");
    return bytes;
  }));
  const uploaded: string[] = [];
  try {
    for (const [i, bytes] of assets.entries()) uploaded.push(await uploadImage(new File([new Uint8Array(bytes)], i === 0 ? "logo.png" : "favicon.png", { type: "image/png" })));
    const result = await applyBrandRelease(plan, { logoKey: uploaded[0], faviconKey: uploaded[1] });
    console.log(`Owner brand release: ${result.reason}.`);
  } finally {
    for (const key of uploaded) {
      try {
        const references = await db.storeSettings.count({ where: { OR: [{ logoKey: key }, { faviconKey: key }, { heroImageKey: key }] } }) + await db.productImage.count({ where: { key } }) + await db.expense.count({ where: { attachment: key } });
        if (!references) await deleteImage(key);
      } catch { console.warn("An unused brand asset may remain private; no referenced object was deleted."); }
    }
  }
}
main().catch(error => { console.error(error instanceof AppError ? error.message : "Owner brand release failed; no credentials logged."); process.exitCode = 1; }).finally(() => db.$disconnect());
