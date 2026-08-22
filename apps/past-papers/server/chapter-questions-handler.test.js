import { describe, it, expect } from "vitest";
import { handleChapterQuestions } from "./chapter-questions-handler.js";

const PAGE_SIZE = 1000; // must match supabase-rows.js

// A chainable fake matching the shape chapter-questions-handler.js calls:
// .from().select().eq().like().order().range() -> { data, error }. `total`
// rows are handed back paged, so a test can prove fetchAllRows is actually
// wired in rather than a bare .range() call that would silently truncate at
// 1000 (see server-logic.test.js's fetchAllRows suite for why that matters).
function fakeSupabase(total, { captureArgs } = {}) {
  const builder = {
    from(...args) {
      captureArgs?.from?.(...args);
      return builder;
    },
    select(...args) {
      captureArgs?.select?.(...args);
      return builder;
    },
    eq(...args) {
      captureArgs?.eq?.(...args);
      return builder;
    },
    like(...args) {
      captureArgs?.like?.(...args);
      return builder;
    },
    order(...args) {
      captureArgs?.order?.(...args);
      return builder;
    },
    range(from, to) {
      const slice = [];
      for (let i = from; i <= Math.min(to, total - 1); i++) {
        slice.push({ id: `P2-${String(i).padStart(3, "0")}`, chapter_num: 1, paper: `June-2020-${i}` });
      }
      return Promise.resolve({ data: slice, error: null });
    },
  };
  return () => ({ from: builder.from });
}

describe("handleChapterQuestions rejects bad input before touching Supabase", () => {
  const reject = async (query) => handleChapterQuestions(query, () => {
    throw new Error("supabaseFactory should not be called for invalid input");
  });

  it("400s on a missing subject", async () => {
    expect(await reject({ paperNum: "2" })).toMatchObject({ status: 400 });
  });

  it("400s on an empty subject", async () => {
    expect(await reject({ subject: "", paperNum: "2" })).toMatchObject({ status: 400 });
  });

  it("400s on a non-numeric paperNum", async () => {
    expect(await reject({ subject: "0607", paperNum: "abc" })).toMatchObject({ status: 400 });
  });

  it("400s on a zero or negative paperNum", async () => {
    expect(await reject({ subject: "0607", paperNum: "0" })).toMatchObject({ status: 400 });
    expect(await reject({ subject: "0607", paperNum: "-1" })).toMatchObject({ status: 400 });
  });

  it("400s on an out-of-range paperNum", async () => {
    expect(await reject({ subject: "0607", paperNum: "100" })).toMatchObject({ status: 400 });
  });

  it("400s on a missing query object entirely", async () => {
    expect(await handleChapterQuestions(undefined, () => {
      throw new Error("should not be called");
    })).toMatchObject({ status: 400 });
  });
});

describe("handleChapterQuestions — success path", () => {
  it("scopes the query to subject and the P<n>- id prefix", async () => {
    const captured = {};
    const factory = fakeSupabase(3, {
      captureArgs: {
        from: (table) => (captured.table = table),
        select: (cols) => (captured.select = cols),
        eq: (col, val) => (captured.eq = [col, val]),
        like: (col, pattern) => (captured.like = [col, pattern]),
      },
    });

    const result = await handleChapterQuestions({ subject: "0607", paperNum: "2" }, factory);

    expect(result.status).toBe(200);
    expect(captured.table).toBe("questions_metadata");
    expect(captured.select).toBe("id, chapter_num, paper");
    expect(captured.eq).toEqual(["subject", "0607"]);
    expect(captured.like).toEqual(["id", "P2-%"]);
    expect(result.body.rows).toHaveLength(3);
  });

  it("pages past the 1000-row PostgREST cap rather than truncating", async () => {
    const factory = fakeSupabase(PAGE_SIZE + 42);
    const result = await handleChapterQuestions({ subject: "0607", paperNum: "2" }, factory);
    expect(result.status).toBe(200);
    expect(result.body.rows).toHaveLength(PAGE_SIZE + 42);
  });

  it("returns 500 rather than throwing when the query errors", async () => {
    const factory = () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            like: () => ({
              order: () => ({
                range: () => Promise.resolve({ data: null, error: { message: "boom" } }),
              }),
            }),
          }),
        }),
      }),
    });
    const result = await handleChapterQuestions({ subject: "0607", paperNum: "2" }, factory);
    expect(result.status).toBe(500);
  });
});
