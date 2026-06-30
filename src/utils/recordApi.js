import { parseSeriesRecord, STORAGE_SERIES } from './seriesStorage';

const SAVE_DEBOUNCE_MS = 400;
const EDIT_UNLOCK_KEY = 'lolgbps-edit-unlocked';

let saveTimer = null;
let saveChain = Promise.resolve();
let savePending = false;
let lastSavedUpdatedAt = null;

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

function parseRemoteBody(body) {
  if (!body || typeof body !== 'object') return { record: null, updatedAt: null };
  if (body.version === 2) {
    return { record: parseSeriesRecord(body), updatedAt: null };
  }
  return {
    record: body.record ? parseSeriesRecord(body.record) : null,
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : null,
  };
}

export async function fetchRemoteRecordMeta() {
  const res = await fetch('/api/record', { cache: 'no-store' });
  if (!res.ok) throw new Error(`load failed: ${res.status}`);
  const body = await res.json();
  return parseRemoteBody(body);
}

export async function fetchRemoteRecord() {
  const { record } = await fetchRemoteRecordMeta();
  return record;
}

async function putRemoteRecord(payload) {
  const res = await fetch('/api/record', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  const body = await res.json();
  return typeof body.updatedAt === 'string' ? body.updatedAt : null;
}

export async function loadPersistedRecord() {
  try {
    const remote = await fetchRemoteRecordMeta();
    if (remote.record) return { record: remote.record, updatedAt: remote.updatedAt };
  } catch (err) {
    console.warn('remote record unavailable, using local fallback', err);
  }
  return { record: readLocalRecord(), updatedAt: null };
}

export function isSavePending() {
  return savePending;
}

export function getLastSavedUpdatedAt() {
  return lastSavedUpdatedAt;
}

export function schedulePersistRecord(payload, onSaved) {
  writeLocalRecord(payload);
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveChain = saveChain
      .then(async () => {
        const updatedAt = await putRemoteRecord(payload);
        if (updatedAt) lastSavedUpdatedAt = updatedAt;
        onSaved?.(updatedAt);
      })
      .catch((err) => console.error('remote record save failed', err))
      .finally(() => {
        savePending = false;
      });
  }, SAVE_DEBOUNCE_MS);
}

export async function flushPersistRecord(payload) {
  writeLocalRecord(payload);
  clearTimeout(saveTimer);
  savePending = true;
  saveChain = saveChain
    .then(async () => {
      const updatedAt = await putRemoteRecord(payload);
      if (updatedAt) lastSavedUpdatedAt = updatedAt;
      return updatedAt;
    })
    .catch((err) => {
      console.error('remote record flush failed', err);
      return null;
    })
    .finally(() => {
      savePending = false;
    });
  return saveChain;
}

export function readEditUnlocked() {
  try {
    return sessionStorage.getItem(EDIT_UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeEditUnlocked(unlocked) {
  try {
    if (unlocked) sessionStorage.setItem(EDIT_UNLOCK_KEY, '1');
    else sessionStorage.removeItem(EDIT_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}
