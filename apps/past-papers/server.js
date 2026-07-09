import express from 'express';
import cors from 'cors';
import { handleCompose } from './server/compose-handler.js';
import { handleChapterPaper } from './server/chapter-handler.js';
import { createLocalLoader } from './server/loaders.js';

const app = express();
const port = process.env.SERVER_PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// PDF composition endpoint (dev) — reads source PDFs from local disk.
// Production uses the same handler via api/compose-paper.js with an R2 loader.
app.post('/api/compose-paper', async (req, res) => {
  const { status, body } = await handleCompose(req.body, createLocalLoader);
  res.status(status).json(body);
});

// Chapter download with a year range / ordering that the prebuilt topical PDFs
// don't cover. Composes, caches to R2, responds with the object's public URL.
app.post('/api/chapter-paper', async (req, res) => {
  const { status, body } = await handleChapterPaper(req.body, createLocalLoader);
  res.status(status).json(body);
});

app.listen(port, () => {
  console.log(`Past Papers API server running on port ${port}`);
});
