import pg from 'pg';

const { Pool } = pg;

let pool = null;
let memoryRecord = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function initDb() {
  const db = getPool();
  if (!db) {
    console.warn('[db] DATABASE_URL not set — using in-memory storage');
    return;
  }
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_record (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getRecord() {
  const db = getPool();
  if (!db) return memoryRecord;
  const result = await db.query('SELECT data FROM app_record WHERE id = $1', ['default']);
  if (!result.rows.length) return null;
  return result.rows[0].data;
}

export async function saveRecord(data) {
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
