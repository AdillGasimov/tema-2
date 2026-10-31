import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { endpoint } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { syncSheets } from "@/lib/sheets";
export async function POST(req: NextRequest) { return endpoint(async () => {
  const actual = Buffer.from(req.headers.get("authorization") ?? ""), expected = Buffer.from(`Bearer ${process.env.JOB_SECRET ?? ""}`);
  if (!process.env.JOB_SECRET || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AppError("Unauthorized", 401);
  return syncSheets();
}); }
