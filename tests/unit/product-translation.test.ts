import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateProductText } from "../../src/lib/product-translation";

const input = { name: "Avroluks AV-198 Glass Spray 50 ml", description: "Glass spray, model AV-198. Volume: 50 ml.", shortDescription: "Glass spray 50 ml." };
const translated = { name: "Avroluks AV-198 şüşə spreyi — 50 ml", description: "Avroluks AV-198 modeli olan şüşə spreyi. Həcm: 50 ml.", shortDescription: "50 ml həcmli Avroluks AV-198 şüşə spreyi." };
const completion = (text: unknown = translated, finishReason = "stop", refusal: string | null = null) => ({
  id: "chatcmpl-test", object: "chat.completion", created: 1794585600, model: "gpt-4.1-mini",
  choices: [{ index: 0, message: { role: "assistant", content: typeof text === "string" ? text : JSON.stringify(text), refusal, annotations: [] }, logprobs: null, finish_reason: finishReason }],
  usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 }, service_tier: "default", system_fingerprint: "fp_test",
});
let requests: { url: string; options?: RequestInit }[];
beforeEach(() => {
  requests = []; vi.stubEnv("OPENAI_API_KEY", "test-private-translation-key");
  vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
    requests.push({ url, options });
    return Response.json(completion());
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("private product translation adapter", () => {
  it("returns validated Azerbaijani text through a bounded, non-stored structured-output request", async () => {
    expect(await translateProductText(input)).toEqual(translated);
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.openai.com/v1/chat/completions");
    expect(new Headers(requests[0].options?.headers).get("authorization")).toBe("Bearer test-private-translation-key");
    const body = JSON.parse(requests[0].options!.body as string);
    expect(body).toMatchObject({ model: "gpt-4.1-mini", store: false, max_completion_tokens: 6144, response_format: { type: "json_schema", json_schema: { strict: true, schema: { additionalProperties: false } } } });
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].role).toBe("user");
    expect(JSON.parse(body.messages[1].content)).toEqual(input);
    expect(JSON.stringify(body)).not.toContain("test-private-translation-key");
    expect(requests[0].options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps already Azerbaijani presentation when the service returns it unchanged", async () => {
    expect(await translateProductText(translated)).toEqual(translated);
  });

  it("standardizes the store's fragrance terminology", async () => {
    const az = { name: "Avtomobil aromatlaşdırıcısı", shortDescription: "Aromatlaşdırıcı avtomobil üçündür.", description: "Salonda istifadə edilən aromatlaşdırıcı." };
    vi.stubGlobal("fetch", async () => Response.json(completion(az)));
    const result = await translateProductText({ name: "Car air freshener", description: "Air freshener for the cabin.", shortDescription: "" });
    expect(result.name).toBe("Avtomobil ətirləndiricisi");
    expect(result.shortDescription).toBe("Ətirləndirici avtomobil üçündür.");
  });

  it("does not call a paid service when the private key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(translateProductText(input)).rejects.toMatchObject({ status: 503, message: expect.stringContaining("OPENAI_API_KEY") });
    expect(requests).toHaveLength(0);
  });

  it("rejects extra financial fields before any provider call", async () => {
    await expect(translateProductText(Object.assign({}, input, { priceMinor: 1499, stock: 7 }))).rejects.toMatchObject({ name: "ZodError" });
    expect(requests).toHaveLength(0);
  });

  it.each([[401, 503], [403, 503], [429, 429], [500, 502]])("maps provider HTTP %i to a safe owner error", async (upstream, expected) => {
    vi.stubGlobal("fetch", async () => Response.json({ error: { message: "test-private-translation-key should never be echoed" } }, { status: upstream }));
    const error = await translateProductText(input).catch(e => e);
    expect(error).toMatchObject({ status: expected });
    expect(error.message).not.toContain("test-private-translation-key");
  });

  it.each([
    ["refusal", completion(translated, "stop", "Refused")],
    ["truncated output", completion(translated, "length")],
    ["malformed JSON", completion("not JSON")],
    ["missing field", completion({ name: translated.name, description: translated.description })],
    ["unknown field", completion({ ...translated, price: "0" })],
    ["overlong field", completion({ ...translated, description: "a".repeat(10001) })],
    ["changed quantity", completion({ ...translated, description: "Avroluks AV-198 şüşə spreyi. Həcm: 100 ml.", name: "Avroluks AV-198 şüşə spreyi — 100 ml", shortDescription: "100 ml həcmli sprey." })],
    ["invented numeric claim", completion({ ...translated, description: translated.description + " 99 faiz qoruyur." })],
  ])("rejects %s instead of accepting an unsafe translation", async (_label, data) => {
    vi.stubGlobal("fetch", async () => Response.json(data));
    await expect(translateProductText(input)).rejects.toMatchObject({ status: 502 });
  });

  it("bounds an oversized upstream response without revealing it", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ extra: "x".repeat(100000), ...completion() }));
    await expect(translateProductText(input)).rejects.toMatchObject({ status: 502 });
  });

  it("stops a stalled provider request at the documented deadline without retrying", async () => {
    vi.useFakeTimers(); let calls = 0;
    vi.stubGlobal("fetch", (_url: string, options: RequestInit) => {
      calls++;
      return new Promise((_resolve, reject) => options.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    const pending = expect(translateProductText(input)).rejects.toMatchObject({ status: 504 });
    await vi.advanceTimersByTimeAsync(40000); await pending;
    expect(calls).toBe(1);
  });
});
