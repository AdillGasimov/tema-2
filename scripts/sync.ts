import "dotenv/config";
import { syncSheets } from "../src/lib/sheets";
import { db } from "../src/lib/db";
syncSheets().then(result => console.log(result)).finally(() => db.$disconnect());
