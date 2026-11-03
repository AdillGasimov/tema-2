import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { put, get, head, del, list, BlobNotFoundError } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AppError } from "./errors";
import { imageFileError } from "./image-policy";
export const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT || undefined, region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: !!process.env.S3_ENDPOINT,
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } } : {}) });
export const bucket = () => { if (!process.env.S3_BUCKET) throw new AppError("Şəkil yaddaşı konfiqurasiya edilməyib.", 503); return process.env.S3_BUCKET; };
export const validImageKey = (key: string) => /^images\/[a-f0-9-]{36}\.webp$/.test(key);
export function imageStorageProvider(env: Record<string, string | undefined> = process.env): "s3" | "vercel-blob" {
  if (env.S3_BUCKET) return "s3";
  // The SDK resolves OIDC from Vercel's trusted request context as well as env.
  if (env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID) return "vercel-blob";
  throw new AppError("Şəkil yaddaşı konfiqurasiya edilməyib.", 503);
}
async function privateBlob<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof BlobNotFoundError) throw new AppError("Şəkil tapılmadı.", 404);
    throw new AppError("Şəkil yaddaşı ilə bağlantı alınmadı. Mağaza administratoru yaddaş ayarlarını yoxlamalıdır.", 503);
  }
}
export async function uploadImage(file: File) {
  const invalid = imageFileError(file); if (invalid) throw new AppError(invalid);
  const provider = imageStorageProvider();
  let bytes: Buffer;
  try { bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000, animated: false }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer(); }
  catch { throw new AppError("Şəkil faylı oxunmadı."); }
  const key = `images/${randomUUID()}.webp`;
  if (provider === "vercel-blob") {
    await privateBlob(() => put(key, bytes, { access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "image/webp", cacheControlMaxAge: 31536000 }));
  } else await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
  return key;
}
export async function imageExists(key: string) {
  if (!validImageKey(key)) throw new AppError("Şəkil açarı düzgün deyil.");
  if (imageStorageProvider() === "vercel-blob") await privateBlob(() => head(key));
  else await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function imageBytes(key: string) {
  if (!validImageKey(key)) throw new AppError("Şəkil açarı düzgün deyil.");
  if (imageStorageProvider() === "vercel-blob") {
    const result = await privateBlob(() => get(key, { access: "private", useCache: false }));
    if (!result || result.statusCode !== 200) throw new AppError("Şəkil tapılmadı.", 404);
    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  }
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return result.Body!.transformToByteArray();
}
export async function deleteImage(key: string) {
  if (!validImageKey(key)) throw new AppError("Şəkil açarı düzgün deyil.");
  if (imageStorageProvider() === "vercel-blob") await privateBlob(() => del(key));
  else await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function checkImageStorage() {
  if (imageStorageProvider() === "vercel-blob") await privateBlob(() => list({ prefix: "images/", limit: 1 }));
  else await s3.send(new HeadBucketCommand({ Bucket: bucket() }));
}
