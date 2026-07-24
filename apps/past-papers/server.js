import express from 'express';
import cors from 'cors';
import { handleCompose } from './server/compose-handler.js';
import { handleChapterPaper } from './server/chapter-handler.js';
import { createLocalLoader, createR2Loader } from './server/loaders.js';

const app = express();
const port = process.env.SERVER_PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Where the composer reads its source PDFs from. Production always uses R2 (a
// serverless function has no disk). The dev server defaults to R2 too when it's
// configured, so a working checkout doesn't need the multi-GB PastPapers/ folder
// on disk — the same source prod serves. It falls back to the local loader when
// R2 isn't configured. Set PAST_PAPERS_SOURCE=local to force local disk (e.g. to
// test source PDFs you've edited but not yet uploaded to R2).
const source =
  process.env.PAST_PAPERS_SOURCE || (process.env.VITE_R2_PUBLIC_URL ? 'r2' : 'local');
const loaderFactory = source === 'r2' ? createR2Loader : createLocalLoader;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// PDF composition endpoint (dev). Uses the same handler as the production Vercel
// function (api/compose-paper.js); only the source loader differs.
app.post('/api/compose-paper', async (req, res) => {
  const { status, body } = await handleCompose(req.body, loaderFactory);
  res.status(status).json(body);
});

// Chapter download with a year range / ordering that the prebuilt topical PDFs
// don't cover. Composes, caches to R2, responds with the object's public URL.
app.post('/api/chapter-paper', async (req, res) => {
  const { status, body } = await handleChapterPaper(req.body, loaderFactory);
  res.status(status).json(body);
});

app.listen(port, () => {
  console.log(`Past Papers API server running on port ${port} (source: ${source})`);
});
