#!/usr/bin/env node

/**
 * Rebuild pre-built topical PDFs for a subject in R2 using the updated `composePdf` engine
 * which strips blank pages and tightens open-ended crops.
 *
 * Usage:
 *   node --env-file=.env scripts/rebuild-topicals.js <subject> [component]
 *   e.g. node --env-file=.env scripts/rebuild-topicals.js 0455
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { composePdf } from '../server/compose-pdf.js';
import { createR2Loader } from '../server/loaders.js';

function parseFileName(fileName) {
  if (!fileName.toLowerCase().endsWith('.pdf')) return null;
  const stem = fileName.slice(0, -4);
  const lastDash = stem.lastIndexOf('-');
  if (lastDash === -1) return null;
  const typeRaw = stem.slice(lastDash + 1).toUpperCase();
  if (typeRaw !== 'QP' && typeRaw !== 'MS') return null;
  const rest = stem.slice(0, lastDash);
  const firstDash = rest.indexOf('-');
  if (firstDash === -1) return null;
  const numberRaw = rest.slice(0, firstDash);
  const number = Number(numberRaw);
  if (!Number.isFinite(number)) return null;
  const rawName = rest.slice(firstDash + 1).trim();
  if (!rawName) return null;
  const chapterName = rawName.replace(/-+/g, ' ').replace(/\s+/g, ' ').trim();
  return { chapterNumber: number, chapterName, type: typeRaw, fileName };
}

function paperNumOf(component) {
  const m = component.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

const {
  VITE_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET = 'papers',
} = process.env;

const targetSubject = process.argv[2] || '0455';
const targetComponent = process.argv[3];

if (!SUPABASE_URL || !SERVICE_KEY || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing required environment variables in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const PAGE_SIZE = 1000;
async function fetchAllRows(page) {
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

async function rebuild() {
  console.log(`🚀 Starting topical PDF rebuild for subject: ${targetSubject}...`);

  let query = supabase.from('paper_files').select('subject, component, file_name').eq('subject', targetSubject);
  if (targetComponent) query = query.eq('component', targetComponent);

  const { data: files, error } = await query;
  if (error) throw error;

  console.log(`Found ${files.length} topical PDF files to process in paper_files.\n`);
  const loader = createR2Loader(targetSubject);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < files.length; i++) {
    const { component, file_name } = files[i];
    const parsed = parseFileName(file_name);
    if (!parsed) {
      console.warn(`⚠️  Could not parse filename: ${file_name}`);
      continue;
    }

    const paperNum = paperNumOf(component);
    const chapterNum = parsed.chapterNumber;
    const kind = parsed.type; // 'QP' or 'MS'

    console.log(`[${i + 1}/${files.length}] Processing ${component} / ${file_name} (Ch ${chapterNum}, ${kind})...`);

    try {
      // Query questions for this chapter and paper component
      const rows = await fetchAllRows((from, to) =>
        supabase
          .from('questions_metadata')
          .select('id, paper')
          .eq('subject', targetSubject)
          .eq('chapter_num', chapterNum)
          .like('id', `P${paperNum}-%`)
          .order('id')
          .range(from, to)
      );

      if (rows.length === 0) {
        console.warn(`  ⚠️ No questions found in metadata for Ch ${chapterNum} (P${paperNum})`);
        continue;
      }

      const ids = rows.map((r) => r.id);

      // Compose PDF using the live composePdf pipeline (with blank page filtering)
      const { bytes } = await composePdf(ids, targetSubject, loader, {
        order: 'oldest',
        ...(kind === 'MS' ? { markSchemeOnly: true } : { includeMarkScheme: false }),
      });

      const r2Key = `${targetSubject}/${component}/${file_name}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: Buffer.from(bytes),
          ContentType: 'application/pdf',
          ContentDisposition: `inline; filename="${file_name.replace(/["\\]/g, '')}"`,
        })
      );

      console.log(`  ✅ Rebuilt & uploaded to R2: ${r2Key} (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to rebuild ${file_name}:`, err.message || err);
      errorCount++;
    }
  }

  console.log(`\n🎉 Rebuild completed! Success: ${successCount}, Errors: ${errorCount}`);
}

rebuild().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
