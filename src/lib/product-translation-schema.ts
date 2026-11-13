import { z } from "zod";

const plainText = (max: number) => z.string().max(max).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value), "Mətndə etibarsız simvol var.");
export const productTranslationInputSchema = z.object({
  name: plainText(160).pipe(z.string().trim().min(2)),
  shortDescription: plainText(500),
  description: plainText(10000),
}).strict();
export const productTranslationTextSchema = z.object({
  name: plainText(160).pipe(z.string().trim().min(2).refine(value => !/[\r\n\t]/.test(value))),
  shortDescription: plainText(500).pipe(z.string().trim().min(1)),
  description: plainText(10000).pipe(z.string().trim().min(1)),
}).strict();
export type ProductTranslationInput = z.infer<typeof productTranslationInputSchema>;
export type ProductTranslationText = z.infer<typeof productTranslationTextSchema>;
