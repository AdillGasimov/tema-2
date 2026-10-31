import { NextRequest } from "next/server";
import { requirePartner } from "@/lib/auth";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { partnerData, submitDispute } from "@/lib/partner";
export async function GET() { return endpoint(async () => { const { partner } = await requirePartner(); return partnerData(partner.id); }); }
export async function POST(req: NextRequest) { return endpoint(async () => { mutationGuard(req); const { partner, user } = await requirePartner(); await rateLimit(req, "dispute", 5); return submitDispute(await req.json(), partner.id, user.id); }); }
