import { z } from "zod";
import { AppError } from "./errors";
import { readJsonBody } from "./json-body";
import { numericProductFacts } from "./product-translation-facts";
import { productTranslationInputSchema, productTranslationTextSchema, type ProductTranslationInput, type ProductTranslationText } from "./product-translation-schema";

// MyMemory's anonymous API is free with a daily character quota. There is no
// key, account, paid fallback, automatic retry or database transaction here.
const envelope = z.object({ responseStatus: z.coerce.number().int(), quotaFinished: z.boolean().nullish(), responseData: z.object({ translatedText: z.string().trim().min(1).max(20000) }) });
const sameLanguageMessage = "PLEASE SELECT TWO DISTINCT LANGUAGES";
const sameLanguageResponse = z.object({ responseStatus: z.coerce.number().pipe(z.literal(403)), responseDetails: z.literal(sameLanguageMessage), responseData: z.object({ translatedText: z.literal(sameLanguageMessage) }), quotaFinished: z.literal(false).nullish() });
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
function preferredTerms(text: string) {
  return text.replace(/\bhava\s+(?=təravətləndirici)/giu, "").replace(/\p{L}+/gu, word => {
    const lower = word.toLocaleLowerCase("az");
    const stem = ["aromatlaşdırıcı", "təravətləndirici"].find(value => lower.startsWith(value));
    if (!stem) return word;
    let fixed = "ətirləndirici" + lower.slice(stem.length).replace(/ı/g, "i").replace(/a/g, "ə");
    if (word === word.toLocaleUpperCase("az")) return fixed.toLocaleUpperCase("az");
    if (word[0] === word[0].toLocaleUpperCase("az")) fixed = "Ə" + fixed.slice(1);
    return fixed;
  });
}
function chunks(text: string): string[] {
  const result: string[] = []; let chunk = "";
  for (const word of text.match(/\S+\s*/gu) || []) {
    if (bytes(word.trim()) > 480) throw new AppError("Təsvirdə həddən artıq uzun söz var. Mətni CSV-də qısaldın.");
    if (chunk && bytes(chunk + word) > 480) { result.push(chunk); chunk = ""; }
    chunk += word;
  }
  if (chunk) result.push(chunk);
  return result;
}

export async function translateProductText(value: ProductTranslationInput): Promise<ProductTranslationText> {
  const input = productTranslationInputSchema.parse(value);
  const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 40000);
  const cached = new Map<string, string>();
  try {
    async function translate(text: string): Promise<string> {
      const source = text.trim();
      if (cached.has(source)) return cached.get(source)!;
      let result = "";
      for (const chunk of chunks(source)) {
        controller.signal.throwIfAborted();
        const segment = chunk.trim();
        let translated = cached.get(segment);
        if (translated === undefined) {
          const url = new URL("https://api.mymemory.translated.net/get");
          url.search = new URLSearchParams({ q: segment, langpair: "autodetect|az", mt: "1" }).toString();
          const response = await fetch(url, { signal: controller.signal, cache: "no-store", redirect: "error" });
          if (!response.ok) {
            await response.body?.cancel();
            if (response.status === 429) throw new AppError("Pulsuz tərcümə limiti bitib. Hazır nəticələr bu pəncərədə saxlanılır; daha sonra davam edin. Ödəniş tutulmur.", 429);
            throw new AppError("Pulsuz tərcümə xidməti hazırda əlçatan deyil. Hazır nəticələr saxlanılır; daha sonra yenidən cəhd edin.", 502);
          }
          let raw: unknown;
          try { raw = await readJsonBody(response, 64 * 1024); }
          catch { throw new AppError("Tərcümə xidmətindən düzgün cavab alınmadı. Mətn idxal edilmədi.", 502); }
          // With source=autodetect and target=az, this exact response identifies
          // already-Azerbaijani text. A generic denial must never use raw text.
          if (sameLanguageResponse.safeParse(raw).success) translated = preferredTerms(segment);
          else {
            const quota = z.object({ quotaFinished: z.boolean().nullish(), responseStatus: z.coerce.number().optional() }).safeParse(raw);
            if (quota.success && (quota.data.quotaFinished || quota.data.responseStatus === 403 || quota.data.responseStatus === 429)) throw new AppError("Pulsuz tərcümənin günlük limiti bitib. Hazır nəticələr saxlanılır; daha sonra davam edin. Ödəniş tutulmur.", 429);
            const checked = envelope.safeParse(raw);
            if (!checked.success || checked.data.responseStatus !== 200) throw new AppError("Tərcümə cavabı düzgün deyil və ya bu dil hazırda dəstəklənmir. Mətn idxal edilmədi.", 502);
            translated = preferredTerms(checked.data.responseData.translatedText);
          }
          cached.set(segment, translated);
        }
        result += translated + (chunk.match(/\s+$/u)?.[0] || "");
      }
      const completed = result.trim(); cached.set(source, completed); return completed;
    }
    const name = await translate(input.name);
    const description = input.description.trim() ? await translate(input.description) : name;
    const shortDescription = input.shortDescription.trim() ? await translate(input.shortDescription) : description;
    const checked = productTranslationTextSchema.safeParse({ name, description, shortDescription });
    if (!checked.success) throw new AppError("Tərcümə xidməti natamam və ya yararsız mətn qaytardı. Hazır nəticələr saxlanılır; yenidən yoxlayın.", 502);
    const before = numericProductFacts(input), after = numericProductFacts(checked.data);
    if (before.size !== after.size || [...before].some(fact => !after.has(fact))) throw new AppError("Tərcümədə rəqəm, ölçü və ya model dəyişib. Mətn saxlanılmadı; CSV-ni yoxlayın.", 502);
    return checked.data;
  } catch (error) {
    if (controller.signal.aborted) throw new AppError("Tərcümə üçün gözləmə müddəti bitdi. Hazır nəticələr saxlanılır; yenidən cəhd edin.", 504);
    if (error instanceof AppError) throw error;
    throw new AppError("Pulsuz tərcümə xidmətinə qoşulmaq alınmadı. Hazır nəticələr saxlanılır; daha sonra yenidən cəhd edin.", 502);
  } finally { clearTimeout(deadline); }
}
