export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
export const IMAGE_SIZE_MESSAGE = "Şəkil ən çox 4 MB ola bilər.";

export function imageFileError(file: { size: number; type: string }): string | null {
  if (file.size <= 0) return "Boş şəkil faylı qəbul edilmir.";
  if (file.size > MAX_IMAGE_BYTES) return IMAGE_SIZE_MESSAGE;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Yalnız JPG, PNG və WebP şəkilləri qəbul edilir.";
  return null;
}
