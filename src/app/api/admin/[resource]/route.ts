import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { adminMutation, getAdminData } from "@/lib/admin";
type Context = { params: Promise<{ resource: string }> };
export async function GET(req: NextRequest, ctx: Context) { return endpoint(async () => { await requireUser("ADMIN"); return getAdminData((await ctx.params).resource, req.nextUrl.searchParams); }); }
export async function POST(req: NextRequest, ctx: Context) { return endpoint(async () => { mutationGuard(req); const user = await requireUser("ADMIN"); await rateLimit(req, "admin", 120); return adminMutation((await ctx.params).resource, await req.json(), user.id); }); }
