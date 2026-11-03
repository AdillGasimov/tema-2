import { AppError } from "./errors";
import { IMAGE_SIZE_MESSAGE, MAX_IMAGE_BYTES } from "./image-policy";
import { productPhotoUrl } from "./product-photo-policy";

export async function downloadProductPhoto(source: string): Promise<File> {
  let url = productPhotoUrl(source);
  const signal = AbortSignal.timeout(15_000);
  try {
    for (let hop = 0; hop <= 2; hop++) {
      const response = await fetch(url, { redirect: "manual", credentials: "omit", cache: "no-store", signal,
        headers: { Accept: "image/jpeg,image/png,image/webp" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get("location");
        if (!location || hop === 2) throw new AppError("Şəkil keçidində çox sayda yönləndirmə var.");
        url = productPhotoUrl(new URL(location, url).href);
        continue;
      }
      const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
      if (!response.ok || !response.body || !type || !["image/jpeg", "image/png", "image/webp"].includes(type)) {
        await response.body?.cancel();
        throw new AppError("Mənbədən şəkil alınmadı. Keçidi yoxlayıb yenidən cəhd edin.", 422);
      }
      const declared = response.headers.get("content-length");
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_IMAGE_BYTES)) {
        await response.body.cancel(); throw new AppError(IMAGE_SIZE_MESSAGE, 413);
      }
      const reader = response.body.getReader(); const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new AppError(IMAGE_SIZE_MESSAGE, 413); }
          // Copy into owned buffers, suitable for both File and Sharp input.
          chunks.push(new Uint8Array(value));
        }
      } finally { reader.releaseLock(); }
      if (!size) throw new AppError("Mənbədəki şəkil boşdur.", 422);
      return new File(chunks, "product-photo", { type });
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Şəkil mənbəyi ilə bağlantı alınmadı. Yenidən cəhd edin.", 502);
  }
  throw new AppError("Şəkil alınmadı.", 422);
}
