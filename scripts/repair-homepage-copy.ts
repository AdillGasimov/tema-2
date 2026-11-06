import "dotenv/config";
import { repairLegacyHeroTitle } from "../src/lib/homepage-copy";
import { db } from "../src/lib/db";

async function main() {
  try {
    console.log(`Homepage headline repair: ${await repairLegacyHeroTitle()}.`);
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => { console.error("Homepage headline repair failed."); process.exitCode = 1; });
