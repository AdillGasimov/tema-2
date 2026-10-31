import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "./db";
import { AppError } from "./errors";
import { trustedOrigins } from "./site";

export function mutationGuard(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || !trustedOrigins().includes(origin)) throw new AppError("Sorğunun mənbəyi etibarlı deyil.", 403);
  if (!req.headers.get("content-type")?.includes("application/json")) throw new AppError("JSON sorğusu tələb olunur.", 415);
}
export async function rateLimit(req: NextRequest, scope: string, max = 30) {
  const address = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const bucket = Math.floor(Date.now() / 60000);
  const id = createHash("sha256").update(`${scope}:${address}:${bucket}`).digest("hex");
  const record = await db.rateLimit.upsert({ where: { id }, create: { id, count: 1, expiresAt: new Date(Date.now() + 120000) }, update: { count: { increment: 1 } } });
  if (record.count > max) throw new AppError("Çox sayda sorğu göndərildi. Bir dəqiqə sonra yenidən cəhd edin.", 429);
}
export async function endpoint(fn: () => Promise<unknown>) {
  try { const result = await fn(); return result instanceof Response ? result : NextResponse.json(result, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: "Məlumatları yoxlayın.", fields: error.flatten() }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Bu kod, SKU və ya qeyd artıq mövcuddur." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return NextResponse.json({ error: "Qeyd tapılmadı." }, { status: 404 });
    const safe = error as { code?: string; cause?: { kind?: string; originalCode?: string } } | null;
    console.error("Request failed", { name: error instanceof Error ? error.name : "UnknownError", code: safe?.code, kind: safe?.cause?.kind, sqlState: safe?.cause?.originalCode });
    return NextResponse.json({ error: "Əməliyyat alınmadı. Yenidən cəhd edin." }, { status: 500 });
  }
}
