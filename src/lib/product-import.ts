import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, transaction, type Tx } from "./db";
import { AppError } from "./errors";
import { parseProductCsv, type CsvIssue, type CsvProductRow } from "./product-csv";
import { productSchema } from "./validation";

export type ProductImportPreview = { productCount: number; variantCount: number; issues: CsvIssue[]; rows: { line: number; name: string; variant: string; sku: string; category: string; priceMinor: number; costMinor: number; stock: number }[] };
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
    preview.push({ line: row.line, name: row.name, variant: row.variant.name, sku: row.variant.sku, category: category.name, priceMinor: row.variant.priceMinor, costMinor: row.variant.costMinor, stock: row.variant.stock });
  }
  const existingProducts = await reader.product.findMany({ where: { slug: { in: [...groups.keys()] } }, select: { slug: true } });
  const existingVariants = await reader.productVariant.findMany({ where: { sku: { in: [...skus] } }, select: { sku: true } });
  const existingSlugs = new Set(existingProducts.map(p => p.slug)), existingSkus = new Set(existingVariants.map(v => v.sku));
  for (const row of parsed.rows) {
    if (existingSlugs.has(row.slug)) issues.push({ line: row.line, message: `URL adı artıq mağazada var: ${row.slug}.` });
    if (existingSkus.has(row.variant.sku)) issues.push({ line: row.line, message: `SKU artıq mağazada var: ${row.variant.sku}.` });
  }
  const products = issues.length ? [] : [...groups.values()].map(g => productSchema.parse({ name: g.first.name, slug: g.first.slug, description: g.first.description, categoryId: g.categoryId, status: "DRAFT", featured: false, variants: g.rows.map(r => r.variant) }));
  return { productCount: groups.size, variantCount: preview.length, issues, rows: preview, products };
}

export async function previewProductImport(csv: string, defaultCategoryId?: string): Promise<ProductImportPreview> {
  const plan = await planCsv(csv, defaultCategoryId, db);
  return { productCount: plan.productCount, variantCount: plan.variantCount, rows: plan.rows, issues: plan.issues };
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
