import { z } from "zod";
import { fitTranslatedProductText, PRODUCT_TEXT_LIMITS } from "./product-text";

const plainText = (max: number) => z.string().max(max).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), "Mətndə etibarsız simvol var.");
export const productTranslationInputSchema = z.object({
  name: plainText(PRODUCT_TEXT_LIMITS.name).pipe(z.string().trim().min(2)),
  shortDescription: plainText(PRODUCT_TEXT_LIMITS.shortDescription),
  description: plainText(PRODUCT_TEXT_LIMITS.description),
}).strict();
const storedTextSchema = z.object({
  name: plainText(PRODUCT_TEXT_LIMITS.name).pipe(z.string().trim().min(2).refine(value => !/[\r\n\t]/.test(value))),
  shortDescription: plainText(PRODUCT_TEXT_LIMITS.shortDescription).pipe(z.string().trim().min(1)),
  description: plainText(PRODUCT_TEXT_LIMITS.description).pipe(z.string().trim().min(1)),
}).strict();
// Translation expands text. Fit presentation fields before enforcing their
// stored limits, and preserve omitted wording in the complete description.
export const productTranslationTextSchema = z.object({
  name: plainText(PRODUCT_TEXT_LIMITS.description).pipe(z.string().trim().min(2)),
  shortDescription: plainText(PRODUCT_TEXT_LIMITS.description).pipe(z.string().trim().min(1)),
  description: plainText(PRODUCT_TEXT_LIMITS.description).pipe(z.string().trim().min(1)),
}).strict().transform(fitTranslatedProductText).pipe(storedTextSchema);
export type ProductTranslationInput = z.infer<typeof productTranslationInputSchema>;
export type ProductTranslationText = z.infer<typeof productTranslationTextSchema>;
