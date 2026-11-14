import { describe, expect, it } from "vitest";
import { csv } from "../../src/lib/csv";
import { parseProductCsv } from "../../src/lib/product-csv";
import { createTranslationDraft, translatedProductCsv } from "../../src/lib/product-translation-csv";
import { finishTranslationSession, reviewedTranslationSession, type TranslationSession } from "../../src/lib/product-translation-session";

const session = (): TranslationSession => ({ draft: createTranslationDraft(csv([
  ["name", "sku", "price", "cost", "stock"], ["Glass spray", "ONE", "10", "5", "7"], ["Car cloth", "TWO", "15", "6", "4"],
])), results: {} });
const az = (name: string) => ({ name, description: `${name}.`, shortDescription: `${name}.` });

describe("incremental CSV translation sessions", () => {
  it("retains completed translations after a later failure and retries only unfinished products", async () => {
    const state = session(), calls: string[] = [], signal = new AbortController().signal;
    await expect(finishTranslationSession(state, async input => {
      calls.push(input.name);
      if (input.name === "Car cloth") throw new Error("Service unavailable");
      return az("Şüşə spreyi");
    }, { signal, onProgress: () => {} })).rejects.toThrow("Service unavailable");
    expect(calls).toEqual(["Glass spray", "Car cloth"]);
    expect(Object.values(state.results)).toEqual([az("Şüşə spreyi")]);
    const progress: number[] = [], retried: string[] = [];
    const ready = await finishTranslationSession(state, async input => { retried.push(input.name); return az("Mikrofiber dəsmal"); }, { signal, onProgress: p => progress.push(p.done) });
    expect(retried).toEqual(["Car cloth"]); expect(progress).toEqual([1, 2]);
    expect(parseProductCsv(ready).rows.map(row => row.name)).toEqual(["Şüşə spreyi", "Mikrofiber dəsmal"]);
    expect(parseProductCsv(ready).rows[0].variant).toMatchObject({ sku: "ONE", priceMinor: 1000, costMinor: 500, stock: 7 });
  });
  it("stops future provider calls on cancellation while keeping completed work reusable", async () => {
    const state = session(), controller = new AbortController(), calls: string[] = [];
    await expect(finishTranslationSession(state, async input => { calls.push(input.name); return az("Şüşə spreyi"); }, {
      signal: controller.signal, onProgress: p => { if (p.done === 1) controller.abort(); },
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toEqual(["Glass spray"]);
    const ready = await finishTranslationSession(state, async input => { calls.push(input.name); return az("Mikrofiber dəsmal"); }, { signal: new AbortController().signal, onProgress: () => {} });
    expect(calls).toEqual(["Glass spray", "Car cloth"]);
    expect(parseProductCsv(ready).rows).toHaveLength(2);
  });
  it("reuses an explicitly reviewed exported file without contacting a translator", async () => {
    const original = session();
    const ready = translatedProductCsv(original.draft, { "product-1": az("Şüşə spreyi"), "product-2": az("Mikrofiber dəsmal") });
    const reviewed = reviewedTranslationSession(ready);
    const used = await finishTranslationSession(reviewed, async () => { throw new Error("Must not translate a reviewed export"); }, { signal: new AbortController().signal, onProgress: () => {} });
    expect(used).toBe(ready);
    expect(Object.values(reviewed.results)).toEqual([az("Şüşə spreyi"), az("Mikrofiber dəsmal")]);
  });
  it("does not confuse the spreadsheet encoding marker with complete translated text", () => {
    const marked = csv([["name", "sku", "price", "cost", "stock", "furycar_csv_format"], ["English name", "RAW", "10", "5", "1", "1"]]);
    expect(() => reviewedTranslationSession(marked)).toThrow(/təsvir|hazır|Hazır/);
  });
  it("never turns an incomplete provider response into importable supplier text", async () => {
    const state = session();
    await expect(finishTranslationSession(state, async () => ({ name: "Dəsmal", description: "", shortDescription: "" }), { signal: new AbortController().signal, onProgress: () => {} })).rejects.toThrow(/tərcümə|Tərcümə/);
    expect(state.results).toEqual({});
  });
});
