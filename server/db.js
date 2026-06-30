import pg from 'pg';
import dns from 'node:dns';

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

let pool = null;
let memoryRecord = null;

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const internal = process.env.DATABASE_URL.includes('railway.internal');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: internal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
  }
  return pool;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function initDb(maxAttempts = 12, delayMs = 3000) {
  const db = getPool();
  if (!db) {
    console.warn('[db] DATABASE_URL not set — using in-memory storage');
    return;
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS app_record (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      console.log('[db] ready');
      dbReady = true;
      return;
    } catch (err) {
      lastError = err;
      console.error(`[db] init attempt ${attempt}/${maxAttempts} failed:`, err.message);
      if (attempt < maxAttempts) await sleep(delayMs);
    }
  }
  throw lastError;
}

let dbReady = false;

export async function ensureDb() {
  if (dbReady || !process.env.DATABASE_URL) return dbReady;
  await initDb();
  dbReady = true;
  return true;
}

export async function getRecord() {
  await ensureDb();
  const db = getPool();
  if (!db) return memoryRecord;
  const result = await db.query('SELECT data FROM app_record WHERE id = $1', ['default']);
  if (!result.rows.length) return null;
  return result.rows[0].data;
}

export async function saveRecord(data) {
  await ensureDb();
  const db = getPool();
  if (!db) {
    memoryRecord = data;
    return;
  }
  await db.query(
    `INSERT INTO app_record (id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $2::jsonb, updated_at = NOW()`,
    ['default', JSON.stringify(data)],
  );
}
