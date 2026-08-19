import { describe, it, expect, vi, beforeEach } from "vitest";

const readObjectBytes = vi.fn();
vi.mock("./r2-cache.js", () => ({
  CACHE_PREFIX: "_cache",
  readObjectBytes: (...args) => readObjectBytes(...args),
}));

const { handleProxyPaper } = await import("./proxy-paper-handler.js");

describe("handleProxyPaper", () => {
  beforeEach(() => {
    readObjectBytes.mockReset();
  });

  it("rejects a key outside the cache prefix", async () => {
    const { status, body } = await handleProxyPaper("questions_metadata/secret.json");
    expect(status).toBe(400);
    expect(body.error).toMatch(/invalid/i);
    expect(readObjectBytes).not.toHaveBeenCalled();
  });

  it("rejects a missing or non-string key", async () => {
    expect((await handleProxyPaper(undefined)).status).toBe(400);
    expect((await handleProxyPaper(42)).status).toBe(400);
  });

  it("returns 404 when the object is not found", async () => {
    readObjectBytes.mockResolvedValueOnce(null);
    const { status } = await handleProxyPaper("_cache/0610/missing.pdf");
    expect(status).toBe(404);
  });

  it("returns the bytes for a valid cache key", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    readObjectBytes.mockResolvedValueOnce(bytes);
    const { status, bytes: returned } = await handleProxyPaper("_cache/0610/foo.pdf");
    expect(status).toBe(200);
    expect(returned).toBe(bytes);
    expect(readObjectBytes).toHaveBeenCalledWith("_cache/0610/foo.pdf");
  });

  it("returns 500 on an unexpected R2 error", async () => {
    readObjectBytes.mockRejectedValueOnce(new Error("boom"));
    const { status, body } = await handleProxyPaper("_cache/0610/foo.pdf");
    expect(status).toBe(500);
    expect(body.error).toBeTruthy();
  });
});
