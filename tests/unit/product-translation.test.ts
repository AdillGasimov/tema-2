import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateProductText } from "../../src/lib/product-translation";

const input = { name: "Avroluks AV-198 Glass Spray 50 ml", description: "Glass spray, model AV-198. Volume: 50 ml.", shortDescription: "Glass spray 50 ml." };
const translated = { name: "Avroluks AV-198 şüşə spreyi — 50 ml", description: "Avroluks AV-198 modeli olan şüşə spreyi. Həcm: 50 ml.", shortDescription: "50 ml həcmli Avroluks AV-198 şüşə spreyi." };
const dictionary = new Map(Object.keys(input).map(key => [input[key as keyof typeof input], translated[key as keyof typeof translated]]));
const answer = (text: string) => ({ responseData: { translatedText: text, match: 0.85 }, quotaFinished: false, responseDetails: "", responseStatus: 200 });
let requests: { url: URL; options?: RequestInit }[];
function provider(change: (text: string) => string = text => text) {
  vi.stubGlobal("fetch", async (url: string | URL, options?: RequestInit) => {
    const parsed = new URL(url); requests.push({ url: parsed, options });
    const source = parsed.searchParams.get("q")!;
    return Response.json(answer(change(dictionary.get(source) || source)));
  });
}
beforeEach(() => { requests = []; vi.stubEnv("OPENAI_API_KEY", ""); provider(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("free product translation adapter", () => {
  it("translates all presentation fields without a key, billing endpoint or financial data", async () => {
    expect(await translateProductText(input)).toEqual(translated);
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.url.origin + request.url.pathname).toBe("https://api.mymemory.translated.net/get");
      expect(request.url.searchParams.get("langpair")).toBe("autodetect|az");
      expect(Object.values(input)).toContain(request.url.searchParams.get("q"));
      expect([...request.url.searchParams.keys()].sort()).toEqual(["langpair", "mt", "q"]);
      expect(new Headers(request.options?.headers).has("authorization")).toBe(false);
      expect(request.options?.signal).toBeInstanceOf(AbortSignal);
    }
  });
  it("keeps Azerbaijani text returned unchanged by the translator", async () => {
    expect(await translateProductText(translated)).toEqual(translated);
  });
  it("preserves source text when automatic detection explicitly identifies the target language", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ responseStatus: "403", responseDetails: "PLEASE SELECT TWO DISTINCT LANGUAGES", responseData: { translatedText: "PLEASE SELECT TWO DISTINCT LANGUAGES" }, quotaFinished: null }));
    expect(await translateProductText(translated)).toEqual(translated);
  });
  it("does not treat a generic denial as proof that the source is Azerbaijani", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ responseStatus: "403", responseDetails: "LIMIT REACHED", responseData: { translatedText: "PLEASE SELECT TWO DISTINCT LANGUAGES" }, quotaFinished: null }));
    await expect(translateProductText(input)).rejects.toMatchObject({ status: 429 });
  });
  it("reuses identical text and derives missing descriptions from translated facts", async () => {
    const result = await translateProductText({ name: input.name, description: "", shortDescription: "" });
    expect(result).toEqual({ name: translated.name, description: translated.name, shortDescription: translated.name });
    expect(requests).toHaveLength(1);
  });
  it("uses consistent fragrance terminology including the free provider's wording", async () => {
    provider(() => "Avtomobil hava təravətləndiricisi");
    expect((await translateProductText({ name: "Car air freshener", description: "", shortDescription: "" })).name).toBe("Avtomobil ətirləndiricisi");
    provider(() => "Avtomobil aromatlaşdırıcısı");
    expect((await translateProductText({ name: "Car air freshener", description: "", shortDescription: "" })).name).toBe("Avtomobil ətirləndiricisi");
  });
  it("rejects extra financial fields before sending text", async () => {
    await expect(translateProductText(Object.assign({}, input, { priceMinor: 1499, stock: 7 }))).rejects.toMatchObject({ name: "ZodError" });
    expect(requests).toHaveLength(0);
  });
  it.each([401, 403, 429, 500])("stops on HTTP %i without a fallback or automatic retry", async status => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => { calls++; return Response.json({ responseDetails: "private upstream detail" }, { status }); });
    const error = await translateProductText(input).catch(e => e);
    expect(error.status).toBe(status === 429 ? 429 : 502);
    expect(error.message).not.toContain("private upstream detail");
    expect(calls).toBe(1);
  });
  it("pauses at the free daily quota even if the HTTP response is successful", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => { calls++; return Response.json({ ...answer("DAILY LIMIT"), responseStatus: 403, quotaFinished: true }); });
    await expect(translateProductText(input)).rejects.toMatchObject({ status: 429, message: expect.stringMatching(/pulsuz/i) });
    expect(calls).toBe(1);
  });
  it.each([
    ["invalid envelope", {}],
    ["empty translation", answer("")],
    ["body-level refusal", { ...answer("Not supported"), responseStatus: 400 }],
    ["overlong name", answer("a".repeat(161))],
    ["invalid control characters", answer("Invalid\u0001text")],
  ])("rejects %s before the text can be imported", async (_label, data) => {
    vi.stubGlobal("fetch", async () => Response.json(data));
    await expect(translateProductText(input)).rejects.toMatchObject({ status: 502 });
  });
  it.each([
    ["changed quantity", (text: string) => text.replace(/50 ml/g, "100 ml")],
    ["invented numeric claim", (text: string) => text + " 99 faiz qoruyur."],
    ["changed volume unit with identical digits", (text: string) => text.replace(/50 ml/g, "50 l")],
    ["reused number in an invented percentage", (text: string) => text + " 50 faiz qoruyur."],
    ["changed model with identical digits", (text: string) => text.replace(/AV-198/g, "ZX-198")],
    ["removed negative sign", (text: string) => text.replace(/−10/g, "10")],
  ])("rejects %s", async (label, change) => {
    provider(change);
    const value = label === "removed negative sign" ? { name: "Spray −10 °C", description: "", shortDescription: "" } : input;
    await expect(translateProductText(value)).rejects.toMatchObject({ status: 502, message: expect.stringContaining("ölçü") });
  });
  it("accepts localized dimensions, decimal commas, units and pieces", async () => {
    provider(() => "Mikrofiber dəsmal 40 × 60 sm, 1,5 kq, 2 ədəd, model AV-198");
    const value = { name: "Microfiber cloth 40 x 60 cm, 1.5 kg, 2 pcs, model AV-198", description: "", shortDescription: "" };
    expect((await translateProductText(value)).name).toContain("40 × 60 sm");
  });
  it("splits longer UTF-8 descriptions at words within the documented 500-byte limit", async () => {
    const description = "Yumşaq mikrofiber dəsmal. ".repeat(50).trim();
    const result = await translateProductText({ name: "Mikrofiber dəsmal", description, shortDescription: "" });
    expect(result.description).toBe(description);
    expect(result.shortDescription.length).toBeLessThanOrEqual(500);
    expect(requests.length).toBeGreaterThan(2);
    expect(requests.every(r => Buffer.byteLength(r.url.searchParams.get("q")!, "utf8") <= 500)).toBe(true);
  });
  it("bounds an oversized upstream response", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ...answer("Şüşə spreyi"), extra: "x".repeat(70000) }));
    await expect(translateProductText(input)).rejects.toMatchObject({ status: 502 });
  });
  it("stops a stalled request at the total deadline without retrying", async () => {
    vi.useFakeTimers(); let calls = 0;
    vi.stubGlobal("fetch", (_url: string, options: RequestInit) => {
      calls++;
      return new Promise((_resolve, reject) => options.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    const pending = translateProductText(input).catch(error => error);
    await vi.advanceTimersByTimeAsync(40000); expect(await pending).toMatchObject({ status: 504 });
    expect(calls).toBe(1);
  });
});
