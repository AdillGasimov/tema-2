import { describe, expect, it } from "vitest";
import { fitTranslatedProductText } from "../../src/lib/product-text";

describe("translated product field fitting", () => {
  it("does not duplicate a multiline description when deriving its short preview", () => {
    const description = "Yumşaq mikrofiber dəsmal.\n".repeat(450).trim();
    const result = fitTranslatedProductText({ name: "Mikrofiber dəsmal", shortDescription: description, description });
    expect(result.shortDescription.length).toBeLessThanOrEqual(500);
    expect(result.description).toBe(description);
  });
  it("keeps complete emoji graphemes and remains stable when read again", () => {
    const name = "🧽".repeat(90);
    const result = fitTranslatedProductText({ name, shortDescription: "Şüşə səthləri üçün.", description: "Şüşə səthləri üçün." });
    expect(result.name.length).toBeLessThanOrEqual(160);
    expect(result.name.isWellFormed()).toBe(true);
    expect(result.description).toContain(name);
    expect(fitTranslatedProductText(result)).toEqual(result);
  });
});
