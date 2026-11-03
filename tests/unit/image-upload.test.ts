import { describe, expect, it } from "vitest";
import { imageFileError, IMAGE_SIZE_MESSAGE, MAX_IMAGE_BYTES, MAX_UPLOAD_BODY_BYTES } from "../../src/lib/image-policy";
import { readImageForm } from "../../src/lib/upload-body";

describe("image uploads within hosted request limits", () => {
  it("accepts supported images up to four MiB and rejects oversized, empty or unsupported files", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) expect(imageFileError({ size: MAX_IMAGE_BYTES, type })).toBeNull();
    expect(imageFileError({ size: MAX_IMAGE_BYTES + 1, type: "image/png" })).toBe(IMAGE_SIZE_MESSAGE);
    expect(imageFileError({ size: 0, type: "image/png" })).toBeTruthy();
    expect(imageFileError({ size: 100, type: "image/svg+xml" })).toBeTruthy();
  });
  it("accepts multipart uploads without Content-Length", async () => {
    const form = new FormData(); form.set("file", new File([new Uint8Array(32)], "photo.png", { type: "image/png" }));
    const request = new Request("https://shop.example.test/api/admin/upload", { method: "POST", body: form });
    request.headers.delete("content-length");
    const parsed = await readImageForm(request); const file = parsed.get("file");
    expect(file).toBeInstanceOf(File); expect((file as File).size).toBe(32);
  });
  it("allows multipart overhead around a file at the exact accepted limit", async () => {
    const form = new FormData(); form.set("file", new File([new Uint8Array(MAX_IMAGE_BYTES)], "photo.png", { type: "image/png" }));
    const parsed = await readImageForm(new Request("https://shop.example.test/upload", { method: "POST", body: form }));
    expect((parsed.get("file") as File).size).toBe(MAX_IMAGE_BYTES);
  });
  it.each([undefined, "1"])("bounds the actual body even if Content-Length is missing or incorrect: %s", async length => {
    const headers = new Headers({ "Content-Type": "multipart/form-data; boundary=test" });
    if (length) headers.set("Content-Length", length);
    const request = new Request("https://shop.example.test/upload", { method: "POST", headers, body: new Uint8Array(MAX_UPLOAD_BODY_BYTES + 1) });
    await expect(readImageForm(request)).rejects.toMatchObject({ status: 413, message: IMAGE_SIZE_MESSAGE });
  });
  it("rejects a declared oversized body and invalid multipart input", async () => {
    const request = new Request("https://shop.example.test/upload", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=test", "Content-Length": String(MAX_UPLOAD_BODY_BYTES + 1) }, body: "small" });
    await expect(readImageForm(request)).rejects.toMatchObject({ status: 413 });
    await expect(readImageForm(new Request("https://shop.example.test/upload", { method: "POST", body: "not multipart" }))).rejects.toMatchObject({ status: 415 });
    await expect(readImageForm(new Request("https://shop.example.test/upload", { method: "POST", headers: { "Content-Type": "multipart/form-data" }, body: "invalid" }))).rejects.toMatchObject({ status: 400 });
  });
});
