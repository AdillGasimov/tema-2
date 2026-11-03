import { db } from "@/lib/db";
import { checkImageStorage } from "@/lib/storage";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await Promise.all([db.$queryRaw`SELECT 1`, checkImageStorage()]); return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
