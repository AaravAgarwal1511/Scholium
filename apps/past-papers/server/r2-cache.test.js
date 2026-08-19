import { describe, it, expect, vi, beforeEach } from "vitest";

// `s3()` and the module-level R2_PUBLIC_URL/R2_BUCKET are read from process.env
// at import time, so both the env and the S3Client mock must be in place before
// r2-cache.js is imported — a static top-level import runs too early for that.
const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(function S3Client() {
    return { send };
  }),
  PutObjectCommand: vi.fn().mockImplementation(function PutObjectCommand(input) {
    return input;
  }),
  GetObjectCommand: vi.fn().mockImplementation(function GetObjectCommand(input) {
    return input;
  }),
}));

process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";
process.env.R2_PUBLIC_URL = "https://pub.example.com";

const { writeCached, readObjectBytes } = await import("./r2-cache.js");

/**
 * writeCached's retry loop is what stands between a real student and a "write
 * EPIPE" 500 — a stale pooled keep-alive socket the R2 end already closed,
 * which showed up in practice once compositions started regularly crossing
 * INLINE_LIMIT (see compose-handler.js). The body is a Buffer, never a
 * half-drained stream, so resending it on a transient error is always safe.
 */
describe("writeCached", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("returns the cache URL on the first try when the PUT succeeds", async () => {
    send.mockResolvedValueOnce({});
    const url = await writeCached("_cache/0610/foo.pdf", new Uint8Array([1, 2, 3]), "foo.pdf");
    expect(url).toBe("https://pub.example.com/_cache/0610/foo.pdf");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries on a transient write error and succeeds", async () => {
    const epipe = Object.assign(new Error("write EPIPE"), { code: "EPIPE" });
    send.mockRejectedValueOnce(epipe).mockResolvedValueOnce({});
    const url = await writeCached("_cache/0610/foo.pdf", new Uint8Array([1, 2, 3]), "foo.pdf");
    expect(url).toBe("https://pub.example.com/_cache/0610/foo.pdf");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("gives up after exhausting attempts on repeated transient errors", async () => {
    const econnreset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    send.mockRejectedValue(econnreset);
    await expect(
      writeCached("_cache/0610/foo.pdf", new Uint8Array([1, 2, 3]), "foo.pdf"),
    ).rejects.toThrow("ECONNRESET");
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-transient error", async () => {
    const denied = Object.assign(new Error("Access Denied"), { code: "AccessDenied" });
    send.mockRejectedValueOnce(denied);
    await expect(
      writeCached("_cache/0610/foo.pdf", new Uint8Array([1, 2, 3]), "foo.pdf"),
    ).rejects.toThrow("Access Denied");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

/**
 * readObjectBytes is the server-side counterpart to a browser fetch(url) that
 * the mock-space handoff can't make itself — the bucket has no CORS headers,
 * so it goes through /api/proxy-paper, which calls this instead of hitting the
 * public URL.
 */
describe("readObjectBytes", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("returns the object's bytes on a hit", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => bytes } });
    await expect(readObjectBytes("_cache/0610/foo.pdf")).resolves.toBe(bytes);
  });

  it("returns null rather than throwing on a miss", async () => {
    send.mockRejectedValueOnce(Object.assign(new Error("not found"), { name: "NoSuchKey" }));
    await expect(readObjectBytes("_cache/0610/missing.pdf")).resolves.toBeNull();
  });

  it("propagates any other R2 error", async () => {
    send.mockRejectedValueOnce(Object.assign(new Error("Access Denied"), { name: "AccessDenied" }));
    await expect(readObjectBytes("_cache/0610/foo.pdf")).rejects.toThrow("Access Denied");
  });
});
