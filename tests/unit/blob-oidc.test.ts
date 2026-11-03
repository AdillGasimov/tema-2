import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { checkImageStorage } from "../../src/lib/storage";

const contextKey = Symbol.for("@vercel/request-context");
const apiOrigin = "https://blob.test.invalid";
// Synthetic, unsigned test data. No credentials or requests reach a real service.
const requestToken = `test.${Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString("base64url")}.test`;
let agent: MockAgent;
let originalDispatcher: ReturnType<typeof getGlobalDispatcher>;

beforeEach(() => {
  originalDispatcher = getGlobalDispatcher();
  agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent);
  vi.stubEnv("S3_BUCKET", ""); vi.stubEnv("BLOB_STORE_ID", "store_test-store");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", ""); vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  vi.stubEnv("VERCEL_BLOB_API_URL", apiOrigin);
  vi.stubGlobal(contextKey, { get: () => ({ headers: { "x-vercel-oidc-token": requestToken } }) });
});
afterEach(async () => {
  setGlobalDispatcher(originalDispatcher);
  vi.unstubAllGlobals(); vi.unstubAllEnvs();
  await agent.close();
});

it("lets the real Blob SDK authenticate a store-ID binding from Vercel request context", async () => {
  agent.get(apiOrigin).intercept({
    path: "/?limit=1&prefix=images%2F", method: "GET",
    headers: { authorization: `Bearer ${requestToken}`, "x-vercel-blob-store-id": "test-store" },
  }).reply(200, { blobs: [], hasMore: false });

  await expect(checkImageStorage()).resolves.toBeUndefined();
  agent.assertNoPendingInterceptors();
});

it("still rejects an unauthorized store operation without exposing provider details", async () => {
  agent.get(apiOrigin).intercept({ path: "/?limit=1&prefix=images%2F", method: "GET" })
    .reply(403, { error: { code: "forbidden", message: "private-provider-detail" } });

  await expect(checkImageStorage()).rejects.toMatchObject({
    status: 503, message: expect.not.stringContaining("private-provider-detail"),
  });
  agent.assertNoPendingInterceptors();
});
