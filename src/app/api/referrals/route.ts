import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { activePartner, readReferral, signReferral, REFERRAL_COOKIE } from "@/lib/referrals";
import { db } from "@/lib/db";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { z } from "zod";
export async function GET() { return endpoint(async () => ({ code: readReferral((await cookies()).get(REFERRAL_COOKIE)?.value) })); }
export async function POST(req: NextRequest) {
  return endpoint(async () => {
    mutationGuard(req); await rateLimit(req, "referral", 20);
    const { code } = z.object({ code: z.string().max(24) }).parse(await req.json());
    const p = await activePartner(code);
    const settings = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
    const maxAge = settings.attributionDays * 86400;
    const current = readReferral((await cookies()).get(REFERRAL_COOKIE)?.value);
    if (current !== p.code) await db.referralVisit.create({ data: { partnerId: p.id } });
    const response = NextResponse.json({ code: p.code });
    response.cookies.set(REFERRAL_COOKIE, signReferral(p.code, Date.now() + maxAge * 1000), { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge });
    return response;
  });
}
