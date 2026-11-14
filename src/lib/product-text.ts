export const PRODUCT_TEXT_LIMITS = { name: 160, shortDescription: 500, description: 20000 } as const;
type ProductText = { name: string; shortDescription: string; description: string };

function compactText(text: string, limit: number, title = false) {
  if (text.length <= limit) return text;
  if (title) {
    const clause = text.split(/[,;|](?:\s+|$)/u)[0].trim();
    if (clause.length >= 2 && clause.length <= limit) return clause;
  }
  // Prefer whole words and never split an Azerbaijani letter or emoji. Leave the complete wording in the description.
  let prefix = "";
  for (const { segment } of new Intl.Segmenter("az", { granularity: "grapheme" }).segment(text)) {
    if (prefix.length + segment.length > limit - 1) break;
    prefix += segment;
  }
  const space = prefix.lastIndexOf(" ");
  if (space > 0) prefix = prefix.slice(0, space);
  // A trailing bare value may have lost its unit at this boundary. Remove
  // incomplete dimension suffixes too rather than presenting a new fact.
  prefix = prefix.trim().replace(/(?:\s+(?:[+−-]?\d+(?:[.,]\d+)?|[x×*]))+$/u, "").replace(/[\s,;:|—–-]+$/u, "");
  return prefix + "…";
}

export function fitTranslatedProductText(value: ProductText): ProductText {
  const fullName = value.name.replace(/\s+/gu, " ").trim();
  const fullShort = value.shortDescription.replace(/\s+/gu, " ").trim();
  const name = compactText(fullName, PRODUCT_TEXT_LIMITS.name, true);
  const shortDescription = compactText(fullShort, PRODUCT_TEXT_LIMITS.shortDescription);
  let description = value.description.trim();
  const preserved = [name !== fullName ? fullName : "", shortDescription !== fullShort ? fullShort : ""].filter(Boolean);
  for (const text of preserved) if (!description.replace(/\s+/gu, " ").includes(text)) description += "\n\n" + text;
  return { name, shortDescription, description };
}
