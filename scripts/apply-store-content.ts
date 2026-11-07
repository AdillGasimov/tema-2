import "dotenv/config";
import { readFile } from "node:fs/promises";
import { applyStoreContent, inspectStoreContent } from "../src/lib/store-content-release";
import { db } from "../src/lib/db";
async function main() {
  try {
    const raw: unknown = JSON.parse(await readFile("catalog/curation/2026-11-07-content.json", "utf8"));
    if (process.argv.includes("--check")) console.log(`Owner store content: ${await inspectStoreContent(raw)}.`);
    else console.log(`Owner store content: ${(await applyStoreContent(raw)).reason}.`);
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Owner store content failed."); process.exitCode = 1; });
