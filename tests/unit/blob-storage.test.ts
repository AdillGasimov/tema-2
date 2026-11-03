import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
const sdk = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), head: vi.fn(), del: vi.fn(), list: vi.fn() }));
vi.mock("@vercel/blob", () => ({ ...sdk, BlobNotFoundError: class extends Error {} }));
import { BlobNotFoundError } from "@vercel/blob";
import { checkImageStorage, deleteImage, imageBytes, imageExists, imageStorageProvider, uploadImage, validImageKey } from "../../src/lib/storage";
const key = "images/11111111-1111-4111-8111-111111111111.webp";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("S3_BUCKET", ""); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "mock-token-never-sent-to-a-service");
});
afterEach(() => vi.unstubAllEnvs());
describe("private Vercel image storage", () => {
  it("supports configured Blob token/OIDC access and keeps an existing S3 bucket selected", () => {
    expect(imageStorageProvider({ BLOB_READ_WRITE_TOKEN: "mock" })).toBe("vercel-blob");
    expect(imageStorageProvider({ BLOB_STORE_ID: "mock" })).toBe("vercel-blob");
    expect(imageStorageProvider({ BLOB_STORE_ID: "mock", VERCEL_OIDC_TOKEN: "mock" })).toBe("vercel-blob");
    expect(imageStorageProvider({ S3_BUCKET: "existing", BLOB_READ_WRITE_TOKEN: "mock" })).toBe("s3");
    expect(imageStorageProvider({ S3_BUCKET: "existing", BLOB_STORE_ID: "mock" })).toBe("s3");
    expect(() => imageStorageProvider({})).toThrow("Şəkil yaddaşı konfiqurasiya edilməyib.");
  });
  it("decodes images and writes only private, non-overwriting WebP objects", async () => {
    sdk.put.mockResolvedValue({});
    const photo = await sharp({ create: { width: 24, height: 24, channels: 3, background: "green" } }).png().toBuffer();
    const uploaded = await uploadImage(new File([new Uint8Array(photo)], "photo.png", { type: "image/png" }));
    expect(validImageKey(uploaded)).toBe(true);
    const [pathname, bytes, options] = sdk.put.mock.calls[0];
    expect(pathname).toBe(uploaded); expect((await sharp(bytes).metadata()).format).toBe("webp");
    expect(options).toMatchObject({ access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "image/webp" });
    await expect(uploadImage(new File(["forged"], "photo.png", { type: "image/png" }))).rejects.toThrow("Şəkil faylı oxunmadı.");
    expect(sdk.put).toHaveBeenCalledTimes(1);
  });
  it("reads private contents by key through the server adapter", async () => {
    sdk.get.mockResolvedValue({ statusCode: 200, stream: new Response(new Uint8Array([1, 2, 3])).body });
    expect(await imageBytes(key)).toEqual(new Uint8Array([1, 2, 3]));
    expect(sdk.get).toHaveBeenCalledWith(key, { access: "private", useCache: false });
  });
  it("checks, deletes and probes the store without exposing object metadata", async () => {
    sdk.head.mockResolvedValue({}); sdk.del.mockResolvedValue(undefined); sdk.list.mockResolvedValue({ blobs: [] });
    await imageExists(key); await deleteImage(key); await checkImageStorage();
    expect(sdk.head).toHaveBeenCalledWith(key); expect(sdk.del).toHaveBeenCalledWith(key);
    expect(sdk.list).toHaveBeenCalledWith({ prefix: "images/", limit: 1 });
    await expect(imageBytes("outside/images.txt")).rejects.toThrow(); expect(sdk.get).not.toHaveBeenCalled();
  });
  it("maps missing objects and provider failures to safe errors", async () => {
    sdk.get.mockResolvedValue(null); await expect(imageBytes(key)).rejects.toMatchObject({ status: 404 });
    sdk.head.mockRejectedValue(new BlobNotFoundError()); await expect(imageExists(key)).rejects.toMatchObject({ status: 404 });
    sdk.put.mockRejectedValue(new Error("sensitive-provider-value"));
    const photo = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).png().toBuffer();
    await expect(uploadImage(new File([new Uint8Array(photo)], "photo.png", { type: "image/png" }))).rejects.toMatchObject({ status: 503, message: expect.not.stringContaining("sensitive-provider-value") });
  });
});
