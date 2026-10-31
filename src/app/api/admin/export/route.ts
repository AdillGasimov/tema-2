import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { endpoint } from "@/lib/http";
import { csv } from "@/lib/csv";
import { analytics } from "@/lib/analytics";
export async function GET(req: NextRequest) { return endpoint(async () => {
  await requireUser("ADMIN"); const q = z.object({ type: z.enum(["orders", "payouts", "products", "expenses", "finance"]), from: z.iso.date().optional(), to: z.iso.date().optional() }).parse({ type: req.nextUrl.searchParams.get("type"), from: req.nextUrl.searchParams.get("from") || undefined, to: req.nextUrl.searchParams.get("to") || undefined });
  const from = q.from ? new Date(`${q.from}T00:00:00+04:00`) : undefined, to = q.to ? new Date(`${q.to}T23:59:59.999+04:00`) : undefined;
  const range = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) }; let rows: (string | number | null | undefined)[][] = [];
  if (q.type === "orders") { const orders = await db.order.findMany({ where: { createdAt: range }, orderBy: { createdAt: "desc" } }); rows = [["Sifariş", "Tarix UTC", "Müştəri", "Telefon", "Cəmi AZN", "Alınan AZN", "Geri ödəniş AZN", "Referal", "Status"], ...orders.map(o => [o.reference, o.createdAt.toISOString(), o.customerName, o.phone, (o.totalMinor / 100).toFixed(2), (o.paidMinor / 100).toFixed(2), (o.refundedMinor / 100).toFixed(2), o.referralCode, o.status])]; }
  if (q.type === "payouts") { const payouts = await db.payout.findMany({ where: { createdAt: range }, include: { partner: true } }); rows = [["ID", "Tarix UTC", "Tərəfdaş", "Məbləğ AZN", "Üsul", "İstinad"], ...payouts.map(p => [p.id, p.createdAt.toISOString(), p.partner.name, (p.amountMinor / 100).toFixed(2), p.method, p.reference])]; }
  if (q.type === "products") { const products = await db.productVariant.findMany({ include: { product: true } }); rows = [["Məhsul", "Variant", "SKU", "Maya AZN", "Satış AZN", "Endirim AZN", "Stok", "Rezerv"], ...products.map(v => [v.product.name, v.name, v.sku, (v.costMinor / 100).toFixed(2), (v.priceMinor / 100).toFixed(2), v.discountMinor === null ? "" : (v.discountMinor / 100).toFixed(2), v.stock, v.reserved])]; }
  if (q.type === "expenses") { const expenses = await db.expense.findMany({ where: { date: range } }); rows = [["Tarix UTC", "Kateqoriya", "AZN", "Təsvir"], ...expenses.map(e => [e.date.toISOString(), e.category, (e.amountMinor / 100).toFixed(2), e.description])]; }
  if (q.type === "finance") { const d = await analytics(from, to); rows = [["Göstərici", "AZN (sifariş tarixinə görə kohort)"], ...["revenue", "cogs", "grossProfit", "commissions", "delivery", "packaging", "other", "contribution"].map(k => [k, ((d[k as keyof typeof d] as number) / 100).toFixed(2)])]; }
  return new Response(csv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${q.type}.csv"`, "Cache-Control": "private, no-store" } });
}); }
