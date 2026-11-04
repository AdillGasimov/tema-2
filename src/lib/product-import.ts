import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";
import { parseProductCsv, parsePhotoCsv, type CsvIssue, type CsvProductRow } from "./product-csv";
import { productSchema } from "./validation";
import { MAX_PRODUCT_PHOTOS } from "./product-photo-policy";

export type ProductPhotoJob = { sku: string; url: string };
export type ProductImportPreview = { kind: "products" | "photos"; productCount: number; variantCount: number; photos: ProductPhotoJob[]; issues: CsvIssue[]; rows: { line: number; name: string; variant: string; sku: string; category: string; priceMinor: number | null; costMinor: number | null; stock: number | null; imageCount: number }[] };
export type ProductImportResult = { productCount: number; variantCount: number };
type Plan = ProductImportPreview & { products: z.infer<typeof productSchema>[] };
type Reader = Pick<Tx, "productCategory" | "product" | "productVariant">;
const receiptSchema = z.object({ requestHash: z.string(), productCount: z.number().int(), variantCount: z.number().int() });

async function planCsv(csv: string, defaultCategoryId: string | undefined, reader: Reader): Promise<Plan> {
  const parsed = parseProductCsv(csv); const issues = [...parsed.issues];
  const categories = await reader.productCategory.findMany();
  if (defaultCategoryId && !categories.some(c => c.id === defaultCategoryId)) throw new AppError("Seçilmiş kateqoriya tapılmadı. Səhifəni yeniləyin.");
  const groups = new Map<string, { first: CsvProductRow; categoryId: string; rows: CsvProductRow[] }>();
  const skus = new Set<string>(); const preview: Plan["rows"] = [];
  for (const row of parsed.rows) {
    const matches = row.category ? categories.filter(c => c.slug === row.category || c.name.toLocaleLowerCase("az") === row.category.toLocaleLowerCase("az")) : categories.filter(c => c.id === defaultCategoryId);
    if (matches.length !== 1) { issues.push({ line: row.line, message: "Kateqoriya tapılmadı və ya adı təkrarlanır. Düzgün kateqoriya URL adını yazın və ya ümumi kateqoriya seçin." }); continue; }
    const category = matches[0];
    if (skus.has(row.variant.sku)) issues.push({ line: row.line, message: `SKU faylda təkrarlanır: ${row.variant.sku}.` });
    skus.add(row.variant.sku);
    const group = groups.get(row.slug);
    if (group) {
      if (group.first.name !== row.name || group.first.description !== row.description || group.categoryId !== category.id) issues.push({ line: row.line, message: "Eyni URL adına aid variantlarda məhsul adı, təsvir və kateqoriya eyni olmalıdır." });
      if (group.rows.some(r => r.variant.name === row.variant.name)) issues.push({ line: row.line, message: "Eyni məhsulun variant adları fərqli olmalıdır." });
      group.rows.push(row);
      if (group.rows.length > 30) issues.push({ line: row.line, message: "Bir məhsulda ən çox 30 variant ola bilər." });
    } else groups.set(row.slug, { first: row, categoryId: category.id, rows: [row] });
    preview.push({ line: row.line, name: row.name, variant: row.variant.name, sku: row.variant.sku, category: category.name, priceMinor: row.variant.priceMinor, costMinor: row.variant.costMinor, stock: row.variant.stock, imageCount: row.imageUrls.length });
  }
  const photos: ProductPhotoJob[] = [];
  for (const group of groups.values()) {
    const urls = [...new Set(group.rows.flatMap(r => r.imageUrls))];
    if (urls.length > MAX_PRODUCT_PHOTOS) issues.push({ line: group.first.line, message: "Bir məhsulun bütün variantlarında cəmi ən çox 12 fərqli şəkil ola bilər." });
    photos.push(...urls.map(url => ({ sku: group.first.variant.sku, url })));
  }
  const existingProducts = await reader.product.findMany({ where: { slug: { in: [...groups.keys()] } }, select: { slug: true, status: true } });
  const existingVariants = await reader.productVariant.findMany({ where: { sku: { in: [...skus] } }, select: { sku: true, product: { select: { status: true } } } });
  const existingSlugs = new Set(existingProducts.map(p => p.slug)), existingSkus = new Set(existingVariants.map(v => v.sku));
  const deletedSlugs = new Set(existingProducts.filter(p => p.status === "DELETED").map(p => p.slug)), deletedSkus = new Set(existingVariants.filter(v => v.product.status === "DELETED").map(v => v.sku));
  for (const row of parsed.rows) {
    if (existingSlugs.has(row.slug)) issues.push({ line: row.line, message: deletedSlugs.has(row.slug) ? `URL adı silinmiş məhsula aiddir: ${row.slug}. Silinmişlər bölməsindən bərpa edin və ya fərqli URL adı seçin.` : `URL adı artıq mağazada var: ${row.slug}.` });
    if (existingSkus.has(row.variant.sku)) issues.push({ line: row.line, message: deletedSkus.has(row.variant.sku) ? `SKU silinmiş məhsula aiddir: ${row.variant.sku}. Silinmişlər bölməsindən bərpa edin və ya fərqli SKU seçin.` : `SKU artıq mağazada var: ${row.variant.sku}.` });
  }
  const products = issues.length ? [] : [...groups.values()].map(g => productSchema.parse({ name: g.first.name, slug: g.first.slug, description: g.first.description, categoryId: g.categoryId, status: "DRAFT", featured: false, variants: g.rows.map(r => r.variant) }));
  return { kind: "products", productCount: groups.size, variantCount: preview.length, photos, issues, rows: preview, products };
}

export async function previewProductImport(csv: string, defaultCategoryId?: string): Promise<ProductImportPreview> {
  const plan = await planCsv(csv, defaultCategoryId, db);
  return { kind: plan.kind, productCount: plan.productCount, variantCount: plan.variantCount, photos: plan.photos, rows: plan.rows, issues: plan.issues };
}

export async function previewPhotoImport(csv: string): Promise<ProductImportPreview> {
  const parsed = parsePhotoCsv(csv), issues = [...parsed.issues];
  const variants = await db.productVariant.findMany({ where: { sku: { in: parsed.rows.map(r => r.sku) }, product: { status: { not: "DELETED" } } }, select: {
    sku: true, name: true, product: { select: { id: true, name: true, category: { select: { name: true } }, images: { select: { sourceUrlHash: true } } } },
  } });
  const bySku = new Map(variants.map(v => [v.sku, v]));
  const groups = new Map<string, { sku: string; line: number; existing: (string | null)[]; urls: Set<string> }>();
  const rows: ProductImportPreview["rows"] = [];
  for (const row of parsed.rows) {
    const variant = bySku.get(row.sku);
    if (!variant) { issues.push({ line: row.line, message: `SKU mağazada tapılmadı: ${row.sku}.` }); continue; }
    const product = variant.product;
    const group = groups.get(product.id) ?? { sku: row.sku, line: row.line, existing: product.images.map(i => i.sourceUrlHash), urls: new Set<string>() };
    for (const url of row.imageUrls) group.urls.add(url);
    groups.set(product.id, group);
    rows.push({ line: row.line, sku: row.sku, name: product.name, variant: variant.name, category: product.category.name, priceMinor: null, costMinor: null, stock: null, imageCount: row.imageUrls.length });
  }
  const photos: ProductPhotoJob[] = [];
  for (const group of groups.values()) {
    const pending = [...group.urls].filter(url => !group.existing.includes(createHash("sha256").update(url).digest("hex")));
    if (pending.length + group.existing.length > MAX_PRODUCT_PHOTOS) issues.push({ line: group.line, message: "Mövcud şəkillərlə birlikdə bir məhsulda ən çox 12 şəkil ola bilər." });
    photos.push(...pending.map(url => ({ sku: group.sku, url })));
  }
  return { kind: "photos", productCount: groups.size, variantCount: new Set(rows.map(r => r.sku)).size, photos, issues, rows };
}

export async function importProducts(csv: string, defaultCategoryId: string | undefined, idempotencyKey: string, actorId: string): Promise<ProductImportResult> {
  z.uuid().parse(idempotencyKey);
  const requestHash = createHash("sha256").update(JSON.stringify({ csv, defaultCategoryId: defaultCategoryId ?? null })).digest("hex");
  const receiptId = `product-import:${createHash("sha256").update(JSON.stringify([actorId, idempotencyKey])).digest("hex")}`;
  async function replay(reader: Pick<Tx, "auditLog">) {
    const saved = await reader.auditLog.findUnique({ where: { id: receiptId } });
    if (!saved) return null;
    const receipt = receiptSchema.parse(saved.detail);
    if (receipt.requestHash !== requestHash) throw new AppError("Bu idxal sorğusu dəyişdirilib. Faylı yenidən yoxlayın.", 409);
    return { productCount: receipt.productCount, variantCount: receipt.variantCount };
  }
  try {
    return await transaction(async tx => {
      const previous = await replay(tx); if (previous) return previous;
      const plan = await planCsv(csv, defaultCategoryId, tx);
      if (plan.issues.length) throw new AppError(`İdxal saxlanılmadı. Sətir ${plan.issues[0].line}: ${plan.issues[0].message}`, 409);
      const products: Prisma.ProductCreateManyInput[] = [], variants: Prisma.ProductVariantCreateManyInput[] = [], movements: Prisma.InventoryMovementCreateManyInput[] = [], logs: Prisma.AuditLogCreateManyInput[] = [];
      for (const product of plan.products) {
        const { variants: input, ...fields } = product; const productId = randomUUID();
        products.push({ ...fields, id: productId });
        for (const variant of input) {
          const variantId = randomUUID(); variants.push({ ...variant, id: variantId, productId });
          if (variant.stock) movements.push({ variantId, kind: "ADJUSTMENT", quantity: variant.stock, reason: "CSV idxalı ilə ilkin stok" });
        }
        logs.push({ actorId, action: "product.create", entity: "Product", entityId: productId, detail: { source: "csv", status: "DRAFT", importId: idempotencyKey } });
      }
      const result = { productCount: products.length, variantCount: variants.length };
      logs.push({ id: receiptId, actorId, action: "product.import", entity: "ProductImport", entityId: idempotencyKey, detail: { requestHash, ...result } });
      await tx.product.createMany({ data: products }); await tx.productVariant.createMany({ data: variants });
      if (movements.length) await tx.inventoryMovement.createMany({ data: movements });
      await tx.auditLog.createMany({ data: logs });
      return result;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { const previous = await replay(db); if (previous) return previous; }
    throw e;
  }
}
