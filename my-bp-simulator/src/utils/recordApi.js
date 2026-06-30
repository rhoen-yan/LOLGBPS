import { parseSeriesRecord, STORAGE_SERIES } from './seriesStorage';

const SAVE_DEBOUNCE_MS = 400;
let saveTimer = null;
let saveChain = Promise.resolve();

function readLocalRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_SERIES);
    if (!raw) return null;
    return parseSeriesRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalRecord(payload) {
  try {
    localStorage.setItem(STORAGE_SERIES, JSON.stringify(payload));
  } catch (err) {
    console.error('local record save failed', err);
  }
}

export async function fetchRemoteRecord() {
  const res = await fetch('/api/record', { cache: 'no-store' });
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  const data = await res.json();
  return data ?? null;
}

async function putRemoteRecord(payload) {
  const res = await fetch('/api/record', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
}

export async function loadPersistedRecord() {
  try {
    const remote = await fetchRemoteRecord();
    if (remote) return parseSeriesRecord(remote);
  } catch (err) {
    console.warn('remote record unavailable, using local fallback', err);
  }
  return readLocalRecord();
}

export function schedulePersistRecord(payload) {
  writeLocalRecord(payload);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveChain = saveChain
      .then(() => putRemoteRecord(payload))
      .catch((err) => console.error('remote record save failed', err));
  }, SAVE_DEBOUNCE_MS);
}

export async function flushPersistRecord(payload) {
  writeLocalRecord(payload);
  clearTimeout(saveTimer);
  saveChain = saveChain
    .then(() => putRemoteRecord(payload))
    .catch((err) => console.error('remote record flush failed', err));
  await saveChain;
}
