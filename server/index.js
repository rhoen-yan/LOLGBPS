import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRecord, getPool, initDb, saveRecord } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../my-bp-simulator/dist');
const PORT = Number(process.env.PORT) || 3001;

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', async (_req, res) => {
  let dbOk = false;
  if (process.env.DATABASE_URL) {
    try {
      const db = getPool();
      if (db) {
        await db.query('SELECT 1');
        dbOk = true;
      }
    } catch {
      dbOk = false;
    }
  }
  res.json({
    ok: true,
    storage: process.env.DATABASE_URL ? (dbOk ? 'postgres' : 'postgres-unavailable') : 'memory',
  });
});

app.get('/api/record', async (_req, res) => {
  try {
    const data = await getRecord();
    res.json(data);
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
    await saveRecord(req.body);
    res.json({ ok: true });
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
  await initDb();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LOLGBPS listening on ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
