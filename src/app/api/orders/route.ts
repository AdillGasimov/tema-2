import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { endpoint, mutationGuard, rateLimit } from "@/lib/http";
import { createOrder, whatsappMessage } from "@/lib/commerce";
import { readReferral, REFERRAL_COOKIE } from "@/lib/referrals";
import { getSettings } from "@/lib/settings";
export async function POST(req: NextRequest) { return endpoint(async () => {
  mutationGuard(req); await rateLimit(req, "checkout", 10);
  const order = await createOrder(await req.json(), readReferral((await cookies()).get(REFERRAL_COOKIE)?.value));
  const settings = await getSettings();
  const message = whatsappMessage(order, settings.brandName);
  return { reference: order.reference, status: order.status, totalMinor: order.totalMinor,
    whatsappMessage: message,
    whatsappUrl: `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}` };
}); }
