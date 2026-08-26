#!/usr/bin/env node

/**
 * Snapshots the data `scripts/build-subject-pages.js` needs into a committed
 * JSON file (`scripts/seo-catalog.json`), so the Vercel build reads a file
 * instead of calling Supabase.
 *
 * Why: `build-subject-pages.js` used to query `paper_files` live with the
 * anon key during every Vercel build and fail soft (warn + skip) on any
 * hiccup — a transient network error silently shipped a build with zero
 * `/papers/*` pages and a truncated sitemap. Reading a committed file instead
 * removes that failure class entirely, and lets the page generator also use
 * `questions_metadata` — anon SELECT on that table was revoked (see
 * database/migrations/20260821000000_revoke_anon_questions_metadata.sql), so
 * only a script holding the service-role key, like this one, can read it.
 *
 * Run manually whenever the catalog changes (new papers indexed, new
 * questions classified) — chain it after `pnpm index:papers` and
 * `import-questions-metadata.py`, then commit the updated
 * scripts/seo-catalog.json alongside those data changes, the same way
 * `pnpm index:papers` itself is a manual step run after an R2 upload.
 *
 * Requires in apps/past-papers/.env:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     (questions_metadata has no anon grant)
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllRows } from "../server/supabase-rows.js";

try {
  process.loadEnvFile();
} catch {
  // No local .env — fine when the caller injects env vars directly.
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ build-seo-catalog: missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const OUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "seo-catalog.json");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// A chapter bucket named this holds questions the classifier couldn't place
// under a real syllabus topic — never fit for a public page. Matched
// case-insensitively since it's free text, not an enum.
const UNCLASSIFIED_RE = /unclassified/i;

// questions_metadata has no year/series columns — both live inside `paper`,
// e.g. "June-2016-2" (series-year-component). Malformed/missing values are
// skipped rather than thrown on: this is aggregate SEO copy, not the
// generator's question pool, so a handful of odd rows shouldn't abort the run.
function seriesAndYearOf(paperField) {
  const parts = String(paperField ?? "").split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[1]);
  if (!Number.isFinite(year)) return null;
  return { series: parts[0], year };
}

// One bucket per (subject, chapter_num): the canonical name (questions_metadata's
// chapter_name is hand-classified against the syllabus, unlike the
// filename-derived name buildCatalog() produces — see build-subject-pages.js),
// a real question count, the exam-series/year range, and the most common
// sub-topics, capped so a page can't balloon from a chapter with hundreds of
// distinct hand-written sub-topic strings.
const MAX_SUB_TOPICS = 8;

export function buildChapterStats(metadataRows) {
  const buckets = new Map();
  for (const row of metadataRows) {
    const key = `${row.subject}-${row.chapter_num}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        canonicalName: row.chapter_name,
        questionCount: 0,
        years: new Set(),
        series: new Set(),
        subTopicCounts: new Map(),
      };
      buckets.set(key, bucket);
    }
    bucket.questionCount++;
    const parsed = seriesAndYearOf(row.paper);
    if (parsed) {
      bucket.years.add(parsed.year);
      bucket.series.add(parsed.series);
    }
    if (row.sub_topic) {
      bucket.subTopicCounts.set(row.sub_topic, (bucket.subTopicCounts.get(row.sub_topic) ?? 0) + 1);
    }
  }

  const stats = {};
  for (const [key, bucket] of buckets) {
    const years = Array.from(bucket.years).sort((a, b) => a - b);
    const topSubTopics = Array.from(bucket.subTopicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SUB_TOPICS)
      .map(([name]) => name);
    stats[key] = {
      canonicalName: bucket.canonicalName,
      isUnclassified: UNCLASSIFIED_RE.test(bucket.canonicalName),
      questionCount: bucket.questionCount,
      yearFrom: years[0] ?? null,
      yearTo: years[years.length - 1] ?? null,
      series: Array.from(bucket.series).sort(),
      subTopics: topSubTopics,
    };
  }
  return stats;
}

async function main() {
  console.log("Fetching paper_files ...");
  const paperFiles = await fetchAllRows((from, to) =>
    supabase
      .from("paper_files")
      .select("subject, component, file_name, created_at")
      .order("id")
      .range(from, to),
  );
  if (paperFiles.length === 0) {
    console.error("❌ build-seo-catalog: paper_files returned 0 rows — aborting so the committed snapshot is not wiped.");
    process.exit(1);
  }

  console.log("Fetching questions_metadata ...");
  const metadataRows = await fetchAllRows((from, to) =>
    supabase
      .from("questions_metadata")
      .select("subject, chapter_num, chapter_name, sub_topic, paper")
      .order("subject")
      .order("id")
      .range(from, to),
  );

  const chapterStats = buildChapterStats(metadataRows);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    paperFiles,
    chapterStats,
  };
  writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(
    `✅ build-seo-catalog: wrote ${OUT_PATH} — ${paperFiles.length} paper_files row(s), ` +
      `${metadataRows.length} questions_metadata row(s) across ${Object.keys(chapterStats).length} chapter bucket(s).`,
  );
  console.log("   Commit scripts/seo-catalog.json alongside this run.");
}

main().catch((err) => {
  console.error("❌ build-seo-catalog:", err.message || err);
  process.exit(1);
});
