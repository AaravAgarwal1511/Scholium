import { describe, it, expect } from "vitest";
import { fetchAllRows, fetchRowsByIds } from "./supabase-rows.js";
import { chapterCacheKey, generatedCacheKey, CACHE_PREFIX } from "./r2-cache.js";
import { handleChapterPaper, yearOfPaper } from "./chapter-handler.js";

const PAGE_SIZE = 1000; // must match supabase-rows.js
const ID_CHUNK = 200; //   "

/** A pager that hands back `total` rows, recording the ranges it was asked for. */
function pagerOf(total) {
  const calls = [];
  const page = (from, to) => {
    calls.push([from, to]);
    const slice = [];
    for (let i = from; i <= Math.min(to, total - 1); i++) slice.push({ i });
    return Promise.resolve({ data: slice, error: null });
  };
  return { page, calls };
}

describe("fetchAllRows — the 1000-row cap", () => {
  // PostgREST truncates every response at 1000 rows and reports no error, so a
  // truncated result is indistinguishable from a complete one. questions_metadata
  // holds ~4000 rows. Anything here going wrong silently drops questions off the
  // end of the index rather than failing.

  it("makes a single request when the first page is short", async () => {
    const { page, calls } = pagerOf(12);
    await expect(fetchAllRows(page)).resolves.toHaveLength(12);
    expect(calls).toEqual([[0, 999]]);
  });

  it("asks for a second page when the first comes back exactly full", async () => {
    // The case that matters: 1000 rows looks complete but may not be.
    const { page, calls } = pagerOf(PAGE_SIZE);
    await expect(fetchAllRows(page)).resolves.toHaveLength(PAGE_SIZE);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("pages until a short page ends it", async () => {
    const { page, calls } = pagerOf(2 * PAGE_SIZE + 37);
    await expect(fetchAllRows(page)).resolves.toHaveLength(2 * PAGE_SIZE + 37);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("returns nothing for an empty table without looping", async () => {
    const { page, calls } = pagerOf(0);
    await expect(fetchAllRows(page)).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("treats a null data payload as an empty page", async () => {
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: null }))).resolves.toEqual(
      [],
    );
  });

  it("throws the reported error rather than returning a partial result", async () => {
    const page = (from) =>
      Promise.resolve(
        from === 0
          ? { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ i })), error: null }
          : { data: null, error: { message: "connection reset" } },
      );
    await expect(fetchAllRows(page)).rejects.toThrow("connection reset");
  });
});

describe("fetchRowsByIds — request chunking", () => {
  function chunkerOf() {
    const calls = [];
    const query = (ids) => {
      calls.push(ids.length);
      return Promise.resolve({ data: ids.map((id) => ({ id })), error: null });
    };
    return { query, calls };
  }

  const ids = (n) => Array.from({ length: n }, (_, i) => `P2-${i}`);

  it("sends one request when the selection fits in a chunk", async () => {
    const { query, calls } = chunkerOf();
    await expect(fetchRowsByIds(query, ids(1))).resolves.toHaveLength(1);
    expect(calls).toEqual([1]);
  });

  it("sends one request at exactly the chunk size", async () => {
    const { query, calls } = chunkerOf();
    await fetchRowsByIds(query, ids(ID_CHUNK));
    expect(calls).toEqual([ID_CHUNK]);
  });

  it("splits one row past the chunk size", async () => {
    const { query, calls } = chunkerOf();
    await fetchRowsByIds(query, ids(ID_CHUNK + 1));
    expect(calls).toEqual([ID_CHUNK, 1]);
  });

  it("keeps every row across several chunks", async () => {
    const { query, calls } = chunkerOf();
    const rows = await fetchRowsByIds(query, ids(2 * ID_CHUNK + 1));
    expect(rows).toHaveLength(2 * ID_CHUNK + 1);
    expect(calls).toEqual([ID_CHUNK, ID_CHUNK, 1]);
  });

  it("does nothing for an empty selection", async () => {
    const { query, calls } = chunkerOf();
    await expect(fetchRowsByIds(query, [])).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });

  it("throws the reported error", async () => {
    const query = () => Promise.resolve({ data: null, error: { message: "bad request" } });
    await expect(fetchRowsByIds(query, ids(5))).rejects.toThrow("bad request");
  });
});

describe("cache keys", () => {
  const base = {
    subject: "0607",
    paperNum: 2,
    chapter: 3,
    yearFrom: 2015,
    yearTo: 2020,
    order: "oldest",
    kind: "qp",
  };

  it("is deterministic", () => {
    expect(chapterCacheKey(base)).toBe(chapterCacheKey({ ...base }));
  });

  it("lives under the prefix the paper indexer skips", () => {
    // build-paper-index.js ignores _cache/, so composed PDFs never surface as
    // browseable chapters.
    expect(chapterCacheKey(base).startsWith(`${CACHE_PREFIX}/`)).toBe(true);
  });

  it("changes when any input changes", () => {
    const keys = new Set([
      chapterCacheKey(base),
      chapterCacheKey({ ...base, subject: "0606" }),
      chapterCacheKey({ ...base, paperNum: 4 }),
      chapterCacheKey({ ...base, chapter: 9 }),
      chapterCacheKey({ ...base, yearFrom: 2016 }),
      chapterCacheKey({ ...base, yearTo: 2021 }),
      chapterCacheKey({ ...base, order: "newest" }),
      chapterCacheKey({ ...base, kind: "ms" }),
    ]);
    // A collision would serve one year range's PDF for another's.
    expect(keys.size).toBe(8);
  });

  it("hashes generated papers by content, so identical papers share one object", () => {
    const a = generatedCacheKey("0607", new Uint8Array([1, 2, 3]));
    const b = generatedCacheKey("0607", new Uint8Array([1, 2, 3]));
    const c = generatedCacheKey("0607", new Uint8Array([1, 2, 4]));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    // The version segment is deliberately matched loosely. CACHE_VERSION is meant
    // to be bumped whenever composition output changes — pinning the literal here
    // turns every correct bump into a red build, which is exactly what it did.
    expect(a).toMatch(/^_cache\/0607\/generated-[0-9a-f]{32}-v\d+\.pdf$/);
  });

  it("keeps generated papers of different subjects apart", () => {
    const bytes = new Uint8Array([9, 9, 9]);
    expect(generatedCacheKey("0607", bytes)).not.toBe(generatedCacheKey("0606", bytes));
  });
});

describe("yearOfPaper", () => {
  it("reads the year out of the paper field", () => {
    expect(yearOfPaper("June-2014-1")).toBe(2014);
    expect(yearOfPaper("November-2021-3")).toBe(2021);
  });

  it("returns NaN for anything not in three parts", () => {
    expect(yearOfPaper("June-2014")).toBeNaN();
    expect(yearOfPaper("2014")).toBeNaN();
    expect(yearOfPaper("")).toBeNaN();
    expect(yearOfPaper(undefined)).toBeNaN();
  });
});

describe("handleChapterPaper rejects bad input before doing any work", () => {
  // Validation runs before getSupabase(), so none of these touch the network or
  // need credentials. The loader factory is never reached.
  const ok = {
    subject: "0607",
    paperNum: 2,
    chapter: 3,
    yearFrom: 2015,
    yearTo: 2020,
    order: "oldest",
    kind: "qp",
  };
  const reject = async (patch) => handleChapterPaper({ ...ok, ...patch }, null);

  it("requires a subject", async () => {
    expect(await reject({ subject: undefined })).toMatchObject({ status: 400 });
    expect(await reject({ subject: 42 })).toMatchObject({ status: 400 });
  });

  it("requires a positive integer paperNum", async () => {
    expect(await reject({ paperNum: 0 })).toMatchObject({ status: 400 });
    expect(await reject({ paperNum: -1 })).toMatchObject({ status: 400 });
    expect(await reject({ paperNum: 2.5 })).toMatchObject({ status: 400 });
    expect(await reject({ paperNum: "2" })).toMatchObject({ status: 400 });
  });

  it("requires an integer chapter", async () => {
    expect(await reject({ chapter: "3" })).toMatchObject({ status: 400 });
    expect(await reject({ chapter: 1.5 })).toMatchObject({ status: 400 });
  });

  it("rejects an inverted year range", async () => {
    const res = await reject({ yearFrom: 2020, yearTo: 2015 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yearFrom <= yearTo/);
  });

  it("accepts a single-year range", async () => {
    // Equal bounds are valid; only yearFrom > yearTo is not. Reaching past
    // validation means the next failure is credentials, not a 400.
    const res = await reject({ yearFrom: 2018, yearTo: 2018 });
    expect(res.status).not.toBe(400);
  });

  it("rejects an unknown order or kind", async () => {
    expect(await reject({ order: "sideways" })).toMatchObject({ status: 400 });
    expect(await reject({ kind: "pdf" })).toMatchObject({ status: 400 });
  });

  it("survives a missing body entirely", async () => {
    expect(await handleChapterPaper(undefined, null)).toMatchObject({ status: 400 });
    expect(await handleChapterPaper(null, null)).toMatchObject({ status: 400 });
  });
});
