// PostgREST caps every response at 1000 rows and reports no error — a truncated
// result is indistinguishable from a complete one. `questions_metadata` holds
// ~4000 rows, so any query over it that isn't already bounded to a single
// chapter has to be paged (or chunked) explicitly.

// Rows per page. Matches PostgREST's cap, so a short page means "last page".
const PAGE_SIZE = 1000;

// Ids per `.in()` request. Well under the row cap, and keeps the generated GET
// URL short enough that a large selection can't blow the request-line limit.
const ID_CHUNK = 200;

// `page(from, to)` must apply `.range(from, to)` to an ordered query.
export async function fetchAllRows(page) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

// `queryForIds(idsChunk)` must apply `.in('id', idsChunk)`.
export async function fetchRowsByIds(queryForIds, ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await queryForIds(ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }
  return rows;
}
