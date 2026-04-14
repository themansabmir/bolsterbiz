import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { buildIndex } from './embeddings';
import { handleChat } from './escalation';
import { ChatRequest, ChatResponse } from './types';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Main chat endpoint ───────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const body = req.body as Partial<ChatRequest>;
  const question = body.question?.trim();

  if (!question) {
    return res.status(422).json({ error: 'question is required and must not be empty' });
  }
  if (question.length > 1000) {
    return res.status(422).json({ error: 'question must be 1000 characters or fewer' });
  }

  try {
    const response: ChatResponse = await handleChat(question);
    return res.json(response);
  } catch (err) {
    console.error('Chat handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Serve compiled React frontend ────────────────────────────────────────────
// In production: `npm run build` in /frontend writes to /backend/public
const staticDir = path.join(__dirname, '../public');
app.use(express.static(staticDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// ── Start server after building the embeddings index ─────────────────────────
const PORT = Number(process.env.PORT) || 3001;

(async () => {
  try {
    console.log('Building article embeddings index...');
    await buildIndex();
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
