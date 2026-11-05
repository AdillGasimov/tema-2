import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import { AppError } from "../src/lib/errors";
import { applyCatalogPresentation, catalogPresentationSchema, inspectCatalogPresentation } from "../src/lib/catalog-presentation";
import { deleteImage, uploadImage } from "../src/lib/storage";

async function main() {
  const directory = new URL("../catalog/curation/", import.meta.url);
  const plan = catalogPresentationSchema.parse(JSON.parse(await readFile(new URL("2026-11-06.json", directory), "utf8")));
  const status = await inspectCatalogPresentation(plan);
  if (status !== "ready") { console.log(`Owner catalog presentation: ${status}; no changes.`); return; }
  const files = new Map<string, Buffer>();
  for (const item of plan.items) if (item.coverAsset) {
    const bytes = await readFile(new URL(`assets/${item.coverAsset.file}`, directory));
    if (bytes.length > 4 * 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== item.coverAsset.sha256) throw new AppError("Prepared cover checksum/size mismatch.");
    files.set(item.id, bytes);
  }
  const uploaded = new Map<string, string>();
  try {
    for (const [id, bytes] of files) uploaded.set(id, await uploadImage(new File([new Uint8Array(bytes)], "cover.png", { type: "image/png" })));
    const result = await applyCatalogPresentation(plan, uploaded);
    console.log(`Owner catalog presentation: ${result.reason}; ${result.count} products updated.`);
  } finally {
    for (const imageKey of uploaded.values()) {
      try { if (!await db.productImage.count({ where: { key: imageKey } })) await deleteImage(imageKey); }
      catch { console.warn("An unused prepared cover may remain private; no referenced object was deleted."); }
    }
  }
}
main().catch(error => { console.error(error instanceof AppError ? error.message : "Owner catalog presentation failed; no credentials logged."); process.exitCode = 1; }).finally(() => db.$disconnect());
