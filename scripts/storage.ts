import "dotenv/config";
import S3rver from "s3rver";
import { mkdirSync } from "node:fs";
if (process.env.NODE_ENV === "production") throw new Error("The local storage emulator must never run in production.");
mkdirSync(".local/objects", { recursive: true });
const server = new S3rver({ address: "127.0.0.1", port: 9000, silent: true, directory: ".local/objects", configureBuckets: [{ name: process.env.S3_BUCKET ?? "store-images", configs: [] }] });
server.run().then(() => console.log("Local S3 development storage listening on port 9000."));
