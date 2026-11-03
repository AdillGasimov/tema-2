import { AppError } from "./errors";
import { IMAGE_SIZE_MESSAGE, MAX_UPLOAD_BODY_BYTES } from "./image-policy";

export async function readImageForm(req: Request): Promise<FormData> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) throw new AppError("Şəkil faylı seçin.", 415);
  const declared = req.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_UPLOAD_BODY_BYTES)) {
    throw new AppError(IMAGE_SIZE_MESSAGE, 413);
  }
  if (!req.body) throw new AppError("Şəkil faylı seçin.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_UPLOAD_BODY_BYTES) { await reader.cancel(); throw new AppError(IMAGE_SIZE_MESSAGE, 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Response(bytes.buffer, { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new AppError("Şəkil sorğusu oxunmadı. Faylı yenidən seçin."); }
}
