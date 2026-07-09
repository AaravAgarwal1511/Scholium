#!/usr/bin/env node

/**
 * Rebuild the `paper_files` index from the Cloudflare R2 `papers` bucket.
 *
 * The app lists subjects/components/chapters from this table (R2 can't be listed
 * from the browser), so run this whenever you add or remove files in R2:
 *
 *   pnpm index:papers
 *
 * It lists R2 via rclone (already installed), then REPLACES the table contents
 * with an exact mirror of R2 — so new files appear and deleted files disappear.
 * Object keys are `<subject>/<component>/<file>.pdf`; that maps 1:1 to a row.
 *
 * Requires in apps/past-papers/.env:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     (writes bypass RLS)
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET                     (optional, defaults to "papers")
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';

const {
  VITE_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET = 'papers',
} = process.env;

const missing = Object.entries({
  VITE_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  console.error(`❌ Missing env var(s) in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// List every .pdf key in the R2 bucket via rclone (remote defined purely by env,
// nothing written to ~/.config/rclone).
function listR2Pdfs() {
  const env = {
    ...process.env,
    RCLONE_CONFIG_R2_TYPE: 's3',
    RCLONE_CONFIG_R2_PROVIDER: 'Cloudflare',
    RCLONE_CONFIG_R2_ENDPOINT: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    RCLONE_CONFIG_R2_REGION: 'auto',
    RCLONE_CONFIG_R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY,
  };
  let out;
  try {
    out = execFileSync('rclone', ['lsf', `r2:${R2_BUCKET}`, '-R', '--files-only'], {
      env,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    throw new Error(`rclone listing failed: ${err.message}`);
  }
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.toLowerCase().endsWith('.pdf'));
}

// `<subject>/<component>/<file>.pdf` → row. Anything shallower is skipped.
// The `_source/` prefix holds raw per-exam PDFs for /generate and `_cache/` holds
// composed chapter downloads — neither is a browseable chapter compilation, so
// both are excluded from the index.
function toRow(key) {
  if (key.startsWith('_source/') || key.startsWith('_cache/')) return null;
  const parts = key.split('/');
  if (parts.length < 3) return null;
  const [subject, component, ...rest] = parts;
  return { subject, component, file_name: rest.join('/') };
}

async function main() {
  console.log(`🔎 Listing r2:${R2_BUCKET} ...`);
  const keys = listR2Pdfs();
  const rows = keys.map(toRow).filter(Boolean);

  if (rows.length === 0) {
    console.error('❌ No PDFs found in R2 — aborting so the index is not wiped.');
    process.exit(1);
  }

  // Summary by subject/component.
  const summary = new Map();
  for (const r of rows) {
    const k = `${r.subject}/${r.component}`;
    summary.set(k, (summary.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...summary.entries()].sort()) console.log(`  ${k} — ${n} pdf(s)`);
  console.log(`  total: ${rows.length} files`);

  // Replace the table with an exact mirror of R2 (handles adds AND deletions).
  console.log('\n🧹 Clearing paper_files ...');
  const { error: delErr } = await supabase.from('paper_files').delete().gte('id', 0);
  if (delErr) throw delErr;

  console.log(`📝 Inserting ${rows.length} rows ...`);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('paper_files').insert(rows.slice(i, i + 500));
    if (error) throw error;
  }

  console.log('✅ paper_files now mirrors R2.');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
