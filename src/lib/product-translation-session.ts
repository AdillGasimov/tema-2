import { AppError } from "./errors";
import { createTranslationDraft, translatedProductCsv, type TranslationDraft } from "./product-translation-csv";
import { productTranslationTextSchema, type ProductTranslationInput, type ProductTranslationText } from "./product-translation-schema";

export type TranslationSession = { draft: TranslationDraft; results: Record<string, ProductTranslationText> };
export type TranslationProgress = { done: number; total: number };

// Called only after the administrator explicitly attests that the downloaded
// Azerbaijani file has been reviewed. The encoding marker alone is not proof.
export function reviewedTranslationSession(text: string): TranslationSession {
  const draft = createTranslationDraft(text);
  if (!draft.document.keys.includes("csvFormat")) throw new AppError("Hazır CSV rejimi üçün mağazadan yüklənmiş Azərbaycan dilində faylı seçin.");
  const results: Record<string, ProductTranslationText> = {};
  for (const group of draft.groups) {
    const checked = productTranslationTextSchema.safeParse(group.input);
    if (!checked.success) throw new AppError("Hazır CSV-də Azərbaycan dilində ad, qısa təsvir və ətraflı təsvir tam olmalıdır.");
    results[group.id] = checked.data;
  }
  return { draft, results };
}
export async function finishTranslationSession(
  session: TranslationSession,
  translate: (input: ProductTranslationInput, signal: AbortSignal) => Promise<unknown>,
  options: { signal: AbortSignal; onProgress: (progress: TranslationProgress) => void },
): Promise<string> {
  const progress = () => options.onProgress({ done: session.draft.groups.filter(group => session.results[group.id]).length, total: session.draft.groups.length });
  progress();
  for (const group of session.draft.groups) {
    options.signal.throwIfAborted();
    if (session.results[group.id]) continue;
    const checked = productTranslationTextSchema.safeParse(await translate(group.input, options.signal));
    if (!checked.success) throw new AppError("Tərcümə cavabı düzgün deyil və ya natamamdır. Məhsul idxal edilmədi.", 502);
    session.results[group.id] = checked.data;
    progress();
  }
  options.signal.throwIfAborted();
  return translatedProductCsv(session.draft, session.results);
}
