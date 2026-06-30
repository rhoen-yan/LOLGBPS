import { SERIES_LENGTH_OPTIONS, getWinsToWin } from '../constants';
import { createSeriesEventId } from './championMention';
import { normalizePickLanes } from './pickLanes';

export const STORAGE_SERIES = 'bp-series-record';

export function formatDateYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createSeriesId() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeEvent(ev) {
  if (!ev || typeof ev !== 'object') return null;
  return {
    id: typeof ev.id === 'string' ? ev.id : createSeriesEventId(),
    time: typeof ev.time === 'string' ? ev.time : '',
    text: typeof ev.text === 'string' ? ev.text : '',
  };
}

function normalizeHistoryEntry(entry, legacyOurSide = null) {
  if (!entry || typeof entry.game !== 'number') return null;
  const ourSide = normalizeOurSide(entry.ourSide ?? legacyOurSide);
  return {
    game: entry.game,
    winner: entry.winner === 'Red' ? 'Red' : 'Blue',
    ourSide,
    blueBans: Array.isArray(entry.blueBans) ? entry.blueBans.filter((id) => typeof id === 'string') : [],
    redBans: Array.isArray(entry.redBans) ? entry.redBans.filter((id) => typeof id === 'string') : [],
    bluePicks: Array.isArray(entry.bluePicks) ? entry.bluePicks.filter((id) => typeof id === 'string') : [],
    redPicks: Array.isArray(entry.redPicks) ? entry.redPicks.filter((id) => typeof id === 'string') : [],
    bluePickLanes: normalizePickLanes(entry.bluePicks, entry.bluePickLanes),
    redPickLanes: normalizePickLanes(entry.redPicks, entry.redPickLanes),
    note: typeof entry.note === 'string' ? entry.note : '',
    events: Array.isArray(entry.events) ? entry.events.map(normalizeEvent).filter(Boolean) : [],
  };
}

function normalizeScore(score) {
  const blue = Number(score?.Blue);
  const red = Number(score?.Red);
  return {
    Blue: Number.isFinite(blue) && blue >= 0 ? blue : 0,
    Red: Number.isFinite(red) && red >= 0 ? red : 0,
  };
}

function normalizeOurSide(value) {
  return value === 'Red' ? 'Red' : value === 'Blue' ? 'Blue' : null;
}

function normalizeTeamNames(names, fallback = { Blue: '藍方', Red: '紅方' }) {
  return {
    Blue: typeof names?.Blue === 'string' && names.Blue ? names.Blue : fallback.Blue,
    Red: typeof names?.Red === 'string' && names.Red ? names.Red : fallback.Red,
  };
}

function normalizeArchivedSeries(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const legacyOurSide = normalizeOurSide(entry.ourSide);
  const games = Array.isArray(entry.games)
    ? entry.games.map((g) => normalizeHistoryEntry(g, legacyOurSide)).filter(Boolean)
    : [];
  if (!games.length) return null;
  return {
    id: typeof entry.id === 'string' ? entry.id : createSeriesId(),
    startDate: typeof entry.startDate === 'string' ? entry.startDate : formatDateYmd(),
    seriesLength: SERIES_LENGTH_OPTIONS.includes(entry.seriesLength) ? entry.seriesLength : 5,
    teamNames: normalizeTeamNames(entry.teamNames),
    finalScore: normalizeScore(entry.finalScore),
    games,
  };
}

function normalizeCurrentSeries(data) {
  const legacyOurSide = normalizeOurSide(data?.ourSide);
  const seriesHistory = Array.isArray(data?.seriesHistory)
    ? data.seriesHistory.map((g) => normalizeHistoryEntry(g, legacyOurSide)).filter(Boolean)
    : [];
  const seriesLength = SERIES_LENGTH_OPTIONS.includes(data?.seriesLength) ? data.seriesLength : 5;
  const gameNumber = Number(data?.currentGameNumber);

  return {
    startDate: typeof data?.startDate === 'string' ? data.startDate : null,
    ourSide: normalizeOurSide(data?.ourSide),
    seriesLength,
    currentSeriesScore: normalizeScore(data?.currentSeriesScore),
    currentGameNumber: Number.isFinite(gameNumber) && gameNumber >= 1 ? gameNumber : 1,
    seriesHistory,
    seriesPickedChampions: Array.isArray(data?.seriesPickedChampions)
      ? data.seriesPickedChampions.filter((id) => typeof id === 'string')
      : [],
  };
}

function migrateV1(data) {
  const current = normalizeCurrentSeries(data);
  const archivedSeries = [];
  if (current.seriesHistory.length > 0 || current.currentSeriesScore.Blue > 0 || current.currentSeriesScore.Red > 0) {
    if (!current.startDate) current.startDate = formatDateYmd();
  }
  return { archivedSeries, current };
}

export function parseSeriesRecord(data) {
  if (!data || typeof data !== 'object') return null;

  if (data.version === 2) {
    const archivedSeries = Array.isArray(data.archivedSeries)
      ? data.archivedSeries.map(normalizeArchivedSeries).filter(Boolean)
      : [];
    const current = normalizeCurrentSeries(data.current);
    const teamNames = normalizeTeamNames(data.teamNames);
    return { archivedSeries, current, teamNames };
  }

  const migrated = migrateV1(data);
  return { ...migrated, teamNames: normalizeTeamNames() };
}

export function loadSeriesRecord() {
  try {
    const raw = localStorage.getItem(STORAGE_SERIES);
    if (!raw) return null;
    return parseSeriesRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function buildSeriesRecordPayload({ archivedSeries, current, teamNames }) {
  return {
    version: 2,
    teamNames: normalizeTeamNames(teamNames),
    archivedSeries,
    current,
  };
}

export function saveSeriesRecord({ archivedSeries, current, teamNames }) {
  try {
    localStorage.setItem(
      STORAGE_SERIES,
      JSON.stringify(buildSeriesRecordPayload({ archivedSeries, current, teamNames })),
    );
  } catch (err) {
    console.error('系列賽紀錄儲存失敗', err);
  }
}

export function clearSeriesRecord() {
  localStorage.removeItem(STORAGE_SERIES);
}

export function buildArchivedSeriesSnapshot({
  startDate,
  seriesLength,
  teamNames,
  currentSeriesScore,
  seriesHistory,
}) {
  const games = Array.isArray(seriesHistory) ? seriesHistory.map((g) => normalizeHistoryEntry(g)).filter(Boolean) : [];
  if (!games.length) return null;

  return normalizeArchivedSeries({
    id: createSeriesId(),
    startDate: startDate || formatDateYmd(),
    seriesLength,
    teamNames,
    finalScore: currentSeriesScore,
    games,
  });
}

export function getSeriesTeamName(series, side) {
  return series.teamNames?.[side] || (side === 'Blue' ? '藍方' : '紅方');
}

export function getOurGameResult(game, ourSide) {
  if (!ourSide) return null;
  if (game.winner === ourSide) return 'win';
  return 'loss';
}

export function getClinchingGame(series) {
  const needed = getWinsToWin(series.seriesLength ?? 5);
  let blue = 0;
  let red = 0;
  for (const game of series.games ?? []) {
    if (game.winner === 'Blue') blue += 1;
    else if (game.winner === 'Red') red += 1;
    if (blue >= needed || red >= needed) return game;
  }
  return null;
}

export function getOurSeriesResult(series) {
  if (!isSeriesDecided(series)) return null;
  const clinch = getClinchingGame(series);
  if (!clinch?.ourSide) return null;
  return clinch.winner === clinch.ourSide ? 'win' : 'loss';
}

export function isSeriesDecided(series) {
  const needed = getWinsToWin(series.seriesLength ?? 5);
  const score = series.finalScore ?? { Blue: 0, Red: 0 };
  return score.Blue >= needed || score.Red >= needed;
}

export function computeBoSeriesStats(seriesList, { dateFilter = '', teamFilter = '' } = {}) {
  const teamQ = teamFilter.trim().toLocaleLowerCase('zh-Hant');
  let wins = 0;
  let losses = 0;

  for (const series of seriesList) {
    if (dateFilter && series.startDate !== dateFilter) continue;
    if (teamQ) {
      const blue = getSeriesTeamName(series, 'Blue').toLocaleLowerCase('zh-Hant');
      const red = getSeriesTeamName(series, 'Red').toLocaleLowerCase('zh-Hant');
      if (!blue.includes(teamQ) && !red.includes(teamQ)) continue;
    }
    if (!isSeriesDecided(series)) continue;
    const result = getOurSeriesResult(series);
    if (!result) continue;
    if (result === 'win') wins++;
    else if (result === 'loss') losses++;
  }

  const total = wins + losses;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : null;
  return { wins, losses, total, winRate };
}

export function seriesMatchesFilters(series, { dateFilter, teamFilter, resultFilter, scopeFilter }) {
  if (dateFilter && series.startDate !== dateFilter) return false;

  const teamQ = teamFilter.trim().toLocaleLowerCase('zh-Hant');
  if (teamQ) {
    const blue = getSeriesTeamName(series, 'Blue').toLocaleLowerCase('zh-Hant');
    const red = getSeriesTeamName(series, 'Red').toLocaleLowerCase('zh-Hant');
    if (!blue.includes(teamQ) && !red.includes(teamQ)) return false;
  }

  if (resultFilter === 'all') return true;

  if (scopeFilter === 'series') {
    if (!isSeriesDecided(series)) return false;
    return getOurSeriesResult(series) === resultFilter;
  }

  return series.games.some((g) => g.ourSide && getOurGameResult(g, g.ourSide) === resultFilter);
}

export function filterSeriesGames(series, { resultFilter, scopeFilter }) {
  if (scopeFilter === 'series' || resultFilter === 'all') {
    return series.games;
  }
  return series.games.filter((g) => g.ourSide && getOurGameResult(g, g.ourSide) === resultFilter);
}
