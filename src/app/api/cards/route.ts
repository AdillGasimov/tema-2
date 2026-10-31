import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endpoint } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { imageBytes } from "@/lib/storage";
import sharp from "sharp";
export async function GET(req: NextRequest) { return endpoint(async () => {
  const user = await requireUser(); const ids = [...new Set((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean))];
  if (!ids.length || ids.length > 300) throw new AppError("1–300 tərəfdaş seçin.");
  const partners = await db.partner.findMany({ where: { id: { in: ids }, ...(user.role !== "ADMIN" ? { userId: user.id } : {}) } });
  if (partners.length !== ids.length) throw new AppError("Kartlara giriş icazəsi yoxdur.", 403);
  const s = await db.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
  const format = req.nextUrl.searchParams.get("format") ?? "pdf";
  const url = (code: string) => `${s.domain.replace(/\/$/, "")}/?ref=${encodeURIComponent(code)}`;
  if (format === "png" || format === "svg") {
    if (partners.length !== 1) throw new AppError("Bu format üçün bir tərəfdaş seçin.");
    const p = partners[0]; const headers = { "Content-Type": format === "png" ? "image/png" : "image/svg+xml", "Content-Disposition": `attachment; filename="referral-${p.code}.${format}"`, "Cache-Control": "private, no-store" };
    if (format === "svg") return new Response(await QRCode.toString(url(p.code), { type: "svg", errorCorrectionLevel: "H", margin: 4 }), { headers });
    return new Response(new Uint8Array(await QRCode.toBuffer(url(p.code), { width: 1200, errorCorrectionLevel: "H", margin: 4 })), { headers });
  }
  if (format !== "pdf") throw new AppError("Format düzgün deyil.");
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), "public/fonts/DejaVuSans.ttf")), { subset: true });
  const mm = (n: number) => n * 72 / 25.4;
  const logo = s.logoKey ? await pdf.embedPng(await sharp(Buffer.from(await imageBytes(s.logoKey))).png().toBuffer()) : null;
  for (const p of partners) {
    const page = pdf.addPage([mm(91), mm(61)]); page.setTrimBox(mm(3), mm(3), mm(85), mm(55)); page.setBleedBox(0, 0, mm(91), mm(61));
    page.drawRectangle({ x: mm(3), y: mm(3), width: mm(85), height: mm(55), color: rgb(.976, .984, .953) });
    const text = (str: string, x: number, y: number, size: number, maxWidth = 46) => {
      let fontSize = size; while (font.widthOfTextAtSize(str, fontSize) > mm(maxWidth) && fontSize > 4) fontSize -= .25;
      page.drawText(str, { x: mm(x), y: mm(y), size: fontSize, font, color: rgb(.07, .13, .09) });
    };
    if (logo) page.drawImage(logo, { x: mm(8), y: mm(46), ...logo.scaleToFit(mm(40), mm(7)) });
    else text(s.brandName, 8, 48, 11);
    text("Avtomobiliniz üçün", 8, 37, 7); text("keyfiyyətli aksesuarlar", 8, 32, 7);
    text("QR kodu skan et və", 8, 23, 6); text("məhsullara bax", 8, 19, 6);
    text(`Referal kodu: ${p.code}`, 8, 12, 8); text(new URL(s.domain).host, 8, 7, 5);
    const qr = await pdf.embedPng(await QRCode.toBuffer(url(p.code), { width: 1000, margin: 4, errorCorrectionLevel: "H" }));
    page.drawImage(qr, { x: mm(55), y: mm(20), width: mm(28), height: mm(28) });
    text(p.name, 56, 15, 6, 26);
    // Crop marks stay outside the trim area; actual printed card is 85 × 55 mm.
    for (const [x, y, dx, dy] of [[3, 0, 0, 2], [88, 0, 0, 2], [3, 59, 0, 2], [88, 59, 0, 2], [0, 3, 2, 0], [89, 3, 2, 0], [0, 58, 2, 0], [89, 58, 2, 0]]) page.drawLine({ start: { x: mm(x), y: mm(y) }, end: { x: mm(x + dx), y: mm(y + dy) }, thickness: .25, color: rgb(.3, .3, .3) });
  }
  return new Response(Buffer.from(await pdf.save()), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="referral-cards.pdf"', "Cache-Control": "private, no-store" } });
}); }
