import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureDb, getRecordWithMeta, initDb, saveRecord } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../my-bp-simulator/dist');
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    storage: process.env.DATABASE_URL ? 'postgres' : 'memory',
  });
});

app.get('/api/record', async (_req, res) => {
  try {
    const meta = await getRecordWithMeta();
    res.json({
      record: meta?.data ?? null,
      updatedAt: meta?.updatedAt ?? null,
    });
  } catch (err) {
    console.error('[api] GET /api/record', err);
    res.status(500).json({ error: 'Failed to load record' });
  }
});

app.put('/api/record', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    const updatedAt = await saveRecord(req.body);
    res.json({ ok: true, updatedAt });
  } catch (err) {
    console.error('[api] PUT /api/record', err);
    res.status(500).json({ error: 'Failed to save record' });
  }
});

app.use(express.static(distPath));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LOLGBPS listening on ${PORT}`);
  });

  if (process.env.DATABASE_URL) {
    initDb().catch((err) => {
      console.error('[db] background init failed, will retry on API calls', err.message);
    });
  }
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
