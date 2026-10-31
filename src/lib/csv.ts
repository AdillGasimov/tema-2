export function csv(rows: (string | number | null | undefined)[][]) {
  const cell = (value: string | number | null | undefined) => { let text = String(value ?? ""); if (typeof value === "string" && /^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}
