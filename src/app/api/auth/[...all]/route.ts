import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { endpoint, rateLimit } from "@/lib/http";
const handlers = toNextJsHandler(auth);
export const GET = handlers.GET;
export async function POST(req: NextRequest) {
  return endpoint(async () => { await rateLimit(req, "auth", 15); return handlers.POST(req); });
}
