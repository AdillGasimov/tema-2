import type { ProductTranslationInput } from "./product-translation-schema";

// Compare values together with their units/model codes. Repeating a fact in a
// short description is allowed; changing 50 ml to 50 l or 50% is not.
const unitGroups: Record<string, string[]> = {
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "millilitr"],
  l: ["l", "liter", "liters", "litre", "litres", "litr"],
  mm: ["mm", "millimeter", "millimeters", "millimetr"],
  cm: ["cm", "sm", "centimeter", "centimeters", "santimetr"],
  m: ["m", "meter", "meters", "metre", "metres", "metr"],
  inch: ["inch", "inches", "in", "düym"],
  kg: ["kg", "kq", "kilogram", "kilograms", "kiloqram"],
  g: ["g", "q", "gram", "grams", "qram"],
  mg: ["mg", "mq", "milligram", "milligrams", "milliqram"],
  gsm: ["gsm", "g/m²", "q/m²"],
  pieces: ["pc", "pcs", "piece", "pieces", "ədəd"],
  percent: ["%", "percent", "faiz"],
  celsius: ["°c", "° c", "celsius", "selsi"],
  degree: ["°", "degree", "degrees", "dərəcə"],
  volt: ["v", "volt", "volts"], watt: ["w", "watt", "watts", "vat"],
  mah: ["mah", "ma·h"], ah: ["ah", "a·h"],
  hour: ["h", "hour", "hours", "saat"], minute: ["min", "minute", "minutes", "dəqiqə"],
  second: ["s", "sec", "second", "seconds", "saniyə"],
};
const unitAliases = new Map(Object.entries(unitGroups).flatMap(([unit, names]) => names.map(name => [name, unit] as const)));
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const units = [...unitAliases.keys()].sort((a, b) => b.length - a.length).map(escaped).join("|");
const number = "[+−-]?\\d+(?:[.,]\\d+)?";
const valueKey = (text: string) => String(Number(text.replace("−", "-").replace(",", ".")));

export function numericProductFacts(value: ProductTranslationInput): Set<string> {
  const facts = new Set<string>();
  let text = Object.values(value).join("\n").replace(/https?:\/\/\S+/g, "").replace(/<[^>]*>/g, "");
  // A shared dimension unit applies to each axis: 40 x 60 cm equals
  // 40 sm × 60 sm. Consume dimensions before ordinary measurements.
  const dimensions = new RegExp("(?:" + number + "\\s*[x×*]\\s*){1,2}" + number + "\\s*(" + units + ")(?![\\p{L}\\d])", "giu");
  text = text.replace(dimensions, (match, unit: string) => {
    const values = match.slice(0, match.length - unit.length).match(new RegExp(number, "g"))!;
    for (const n of values) facts.add("measure:" + valueKey(n) + ":" + unitAliases.get(unit.toLocaleLowerCase("az")));
    return " ";
  });
  const measure = new RegExp("(" + number + ")\\s*(" + units + ")(?![\\p{L}\\d])", "giu");
  text = text.replace(measure, (_match, n: string, unit: string) => {
    facts.add("measure:" + valueKey(n) + ":" + unitAliases.get(unit.toLocaleLowerCase("az"))); return " ";
  });
  text = text.replace(new RegExp("%\\s*(" + number + ")", "gu"), (_match, n: string) => {
    facts.add("measure:" + valueKey(n) + ":percent"); return " ";
  });
  text = text.replace(/\b[A-Za-z][A-Za-z\d]*(?:[-_/][A-Za-z\d]+)+\b|\b(?=[A-Za-z\d]*[A-Za-z])(?=[A-Za-z\d]*\d)[A-Za-z\d]+\b/g, model => {
    if (!/\d/.test(model)) return model;
    facts.add("model:" + model.toUpperCase()); return " ";
  });
  for (const n of text.match(new RegExp(number, "g")) || []) facts.add("number:" + valueKey(n));
  return facts;
}
