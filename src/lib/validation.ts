import { z } from "zod";
import { checkoutContactMessages, normalizeCheckoutPhone } from "./checkout-contact";
export const id = z.string().min(1).max(100);
export const minor = z.number().int().min(0).max(100_000_000);
export const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, "Kod 3–24 hərf və ya rəqəm olmalıdır.");
export const phoneSchema = z.string().trim().transform(v => v.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^\+?[0-9]{9,15}$/, "Düzgün telefon nömrəsi daxil edin."));
export const checkoutPhoneSchema = z.string().max(40, checkoutContactMessages.phone).transform((value, ctx) => {
  const phone = normalizeCheckoutPhone(value);
  if (phone) return phone;
  ctx.addIssue({ code: "custom", message: checkoutContactMessages.phone });
  return z.NEVER;
});
export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(), name: z.string().trim().min(2, checkoutContactMessages.name).max(100, checkoutContactMessages.name), phone: checkoutPhoneSchema,
  city: z.string().trim().min(2, checkoutContactMessages.city).max(100, checkoutContactMessages.city), address: z.string().trim().min(5, checkoutContactMessages.address).max(500, checkoutContactMessages.address), notes: z.string().max(1000).default(""),
  referralCode: z.string().trim().max(24).optional(),
  items: z.array(z.object({ variantId: id, quantity: z.number().int().min(1).max(100) })).min(1).max(50),
}).strict();
export const variantSchema = z.object({
  id: id.optional(), name: z.string().min(1).max(100), sku: z.string().trim().min(1).max(80),
  costMinor: minor, priceMinor: minor.min(1), discountMinor: minor.nullable().default(null),
  commissionMinor: minor.nullable().default(null), stock: z.number().int().min(0).max(1_000_000), stockVerified: z.boolean().optional(),
  lowStock: z.number().int().min(0).max(10000).default(5), active: z.boolean().default(true),
}).refine(v => v.discountMinor === null || v.discountMinor < v.priceMinor, { message: "Endirim qiyməti satış qiymətindən az olmalıdır." });
export const productSchema = z.object({
  id: id.optional(), name: z.string().trim().min(2).max(160), slug: z.string().regex(/^[a-z0-9-]+$/).max(180),
  description: z.string().max(10000), shortDescription: z.string().trim().max(500).optional(), needsPriceReview: z.boolean().optional(),
  rightsReviewRequired: z.boolean().optional(), rightsClearance: z.string().trim().max(2000).optional(),
  categoryId: id, status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), featured: z.boolean(),
  seoTitle: z.string().max(180).optional(), seoDescription: z.string().max(300).optional(), variants: z.array(variantSchema).min(1).max(30),
}).strict();
export const partnerSchema = z.object({
  id: id.optional(), name: z.string().min(2).max(120), phone: phoneSchema,
  email: z.union([z.literal(""), z.email().max(200)]).default(""), password: z.string().min(12).max(128).optional(),
  category: z.string().min(2).max(100), businessName: z.string().max(160).default(""), code: codeSchema,
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]).default("ACTIVE"),
  commissionMinor: minor.nullable().default(null), payoutInfo: z.string().max(500).default(""), notes: z.string().max(2000).default(""),
}).strict();
const safeUrl = z.union([z.literal(""), z.url().refine(v => v.startsWith("https://"), "HTTPS ünvanı tələb olunur.")]);
export const settingsSchema = z.object({
  brandName: z.string().trim().min(2).max(80), domain: z.url().refine(v => v.startsWith("https://") || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(v)),
  legalName: z.string().trim().max(160).optional(), taxId: z.string().trim().regex(/^(?:\d{10})?$/, "VÖEN 10 rəqəmdən ibarət olmalıdır.").optional(), businessAddress: z.string().trim().max(500).optional(),
  description: z.string().max(500), logoKey: id.nullable(), faviconKey: id.nullable(), heroImageKey: id.nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  whatsapp: z.union([z.literal(""), phoneSchema]), phone: z.string().max(30), email: z.union([z.literal(""), z.email()]),
  instagram: safeUrl, tiktok: safeUrl, socialLinks: z.string().max(1000), announcement: z.string().max(200),
  heroTitle: z.string().min(1).max(160), heroSubtitle: z.string().max(500), deliveryInfo: z.string().max(1000), deliveryRegions: z.string().min(1).max(1000),
  deliveryTime: z.string().trim().max(500).optional(), deliveryFreeRegions: z.string().trim().max(1000).optional(),
  deliveryFeeMinor: minor, freeDeliveryMinor: minor, attributionDays: z.number().int().min(1).max(365),
  showFeatured: z.boolean(), showNewArrivals: z.boolean(), showCategories: z.boolean(), sheetsEnabled: z.boolean(),
}).strict();
