import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { AppError } from "./errors";
export const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT || undefined, region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: !!process.env.S3_ENDPOINT,
  ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } } : {}) });
export const bucket = () => { if (!process.env.S3_BUCKET) throw new AppError("Şəkil yaddaşı konfiqurasiya edilməyib.", 503); return process.env.S3_BUCKET; };
export const validImageKey = (key: string) => /^images\/[a-f0-9-]{36}\.webp$/.test(key);
export async function uploadImage(file: File) {
  if (file.size === 0 || file.size > 8 * 1024 * 1024) throw new AppError("Şəkil ən çox 8 MB ola bilər.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new AppError("Yalnız JPG, PNG və WebP şəkilləri qəbul edilir.");
  let bytes: Buffer;
  try { bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000, animated: false }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer(); }
  catch { throw new AppError("Şəkil faylı oxunmadı."); }
  const key = `images/${randomUUID()}.webp`;
  await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
  return key;
}
export async function imageExists(key: string) {
  if (!validImageKey(key)) throw new AppError("Şəkil açarı düzgün deyil.");
  await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function imageBytes(key: string) {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return result.Body!.transformToByteArray();
}
export async function deleteImage(key: string) { await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })); }
