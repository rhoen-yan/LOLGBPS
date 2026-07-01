import { createEmptyBpState, getWinsToWin, normalizeSeriesLength, normalizeSeriesMode } from '../constants';
import { createSeriesEventId } from './championMention';
import { normalizePickLanes, normalizePickPlayers } from './pickLanes';
import { LANE_IDS } from '../constants/lanes';

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

function normalizeWinner(value) {
  return value === 'Red' ? 'Red' : value === 'Blue' ? 'Blue' : null;
}

function normalizeHistoryEntry(entry, legacyOurSide = null) {
  if (!entry || typeof entry.game !== 'number') return null;
  const ourSide = normalizeOurSide(entry.ourSide ?? legacyOurSide);
  return {
    game: entry.game,
    winner: normalizeWinner(entry.winner),
    ourSide,
    blueTeamName: typeof entry.blueTeamName === 'string' ? entry.blueTeamName : '',
    redTeamName: typeof entry.redTeamName === 'string' ? entry.redTeamName : '',
    blueBans: Array.isArray(entry.blueBans) ? entry.blueBans.filter((id) => typeof id === 'string') : [],
    redBans: Array.isArray(entry.redBans) ? entry.redBans.filter((id) => typeof id === 'string') : [],
    bluePicks: Array.isArray(entry.bluePicks) ? entry.bluePicks.filter((id) => typeof id === 'string') : [],
    redPicks: Array.isArray(entry.redPicks) ? entry.redPicks.filter((id) => typeof id === 'string') : [],
    bluePickLanes: normalizePickLanes(entry.bluePicks, entry.bluePickLanes),
    redPickLanes: normalizePickLanes(entry.redPicks, entry.redPickLanes),
    bluePickPlayers: normalizePickPlayers(entry.bluePicks, entry.bluePickPlayers),
    redPickPlayers: normalizePickPlayers(entry.redPicks, entry.redPickPlayers),
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

function normalizeSettings(settings) {
  return {
    myTeamName: typeof settings?.myTeamName === 'string' ? settings.myTeamName.trim() : '',
    lanePlayers: normalizeLanePlayers(settings?.lanePlayers),
  };
}

function normalizeLanePlayers(lanePlayers) {
  const out = {};
  for (const lane of LANE_IDS) {
    const raw = Array.isArray(lanePlayers?.[lane]) ? lanePlayers[lane] : [];
    out[lane] = [0, 1].map((index) =>
      typeof raw[index] === 'string' ? raw[index].trim() : '',
    );
  }
  return out;
}

function normalizeDateHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      return {
        id: typeof entry.id === 'string' ? entry.id : createSeriesId(),
        changedAt: typeof entry.changedAt === 'string' ? entry.changedAt : formatDateYmd(),
        previousDate: typeof entry.previousDate === 'string' ? entry.previousDate : '',
        nextDate: typeof entry.nextDate === 'string' ? entry.nextDate : '',
      };
    })
    .filter(Boolean);
}

export function resolveOurSideFromTeamNames(teamNames, myTeamName) {
  const q = myTeamName?.trim();
  if (!q) return null;
  const blue = (teamNames?.Blue ?? '').trim();
  const red = (teamNames?.Red ?? '').trim();
  const blueMatch = blue === q;
  const redMatch = red === q;
  if (blueMatch && !redMatch) return 'Blue';
  if (redMatch && !blueMatch) return 'Red';
  return null;
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
    seriesMode: normalizeSeriesMode(entry.seriesMode),
    seriesLength: normalizeSeriesLength(entry.seriesLength, entry.seriesMode),
    teamNames: normalizeTeamNames(entry.teamNames),
    finalScore: normalizeScore(entry.finalScore),
    dateHistory: normalizeDateHistory(entry.dateHistory),
    games,
  };
}

function normalizeBpState(state) {
  const base = createEmptyBpState();
  if (!state || typeof state !== 'object') return base;
  const step = Number(state.currentStep);
  const normalizeList = (list) =>
    Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  const blueBans = normalizeList(state.teamData?.Blue?.bans);
  const bluePicks = normalizeList(state.teamData?.Blue?.picks);
  const redBans = normalizeList(state.teamData?.Red?.bans);
  const redPicks = normalizeList(state.teamData?.Red?.picks);
  return {
    currentStep: Number.isFinite(step) && step >= 0 ? step : 0,
    selectedChampions: normalizeList(state.selectedChampions),
    banCounts: {
      Blue: Number.isFinite(state.banCounts?.Blue) ? state.banCounts.Blue : blueBans.length,
      Red: Number.isFinite(state.banCounts?.Red) ? state.banCounts.Red : redBans.length,
    },
    pickCounts: {
      Blue: Number.isFinite(state.pickCounts?.Blue) ? state.pickCounts.Blue : bluePicks.length,
      Red: Number.isFinite(state.pickCounts?.Red) ? state.pickCounts.Red : redPicks.length,
    },
    teamData: {
      Blue: { bans: blueBans, picks: bluePicks },
      Red: { bans: redBans, picks: redPicks },
    },
  };
}

function normalizeCurrentSeries(data) {
  const legacyOurSide = normalizeOurSide(data?.ourSide);
  const seriesHistory = Array.isArray(data?.seriesHistory)
    ? data.seriesHistory.map((g) => normalizeHistoryEntry(g, legacyOurSide)).filter(Boolean)
    : [];
  const seriesMode = normalizeSeriesMode(data?.seriesMode);
  const seriesLength = normalizeSeriesLength(data?.seriesLength, seriesMode);
  const gameNumber = Number(data?.currentGameNumber);

  return {
    startDate: typeof data?.startDate === 'string' ? data.startDate : null,
    ourSide: normalizeOurSide(data?.ourSide),
    seriesMode,
    seriesLength,
    currentSeriesScore: normalizeScore(data?.currentSeriesScore),
    currentGameNumber: Number.isFinite(gameNumber) && gameNumber >= 1 ? gameNumber : 1,
    seriesHistory,
    seriesPickedChampions: Array.isArray(data?.seriesPickedChampions)
      ? data.seriesPickedChampions.filter((id) => typeof id === 'string')
      : [],
    dateHistory: normalizeDateHistory(data?.dateHistory),
    bpState: normalizeBpState(data?.bpState),
    teamInputsLocked: Boolean(data?.teamInputsLocked),
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
    const settings = normalizeSettings(data.settings);
    return { archivedSeries, current, teamNames, settings };
  }

  const migrated = migrateV1(data);
  return { ...migrated, teamNames: normalizeTeamNames(), settings: normalizeSettings() };
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

export function buildSeriesRecordPayload({ archivedSeries, current, teamNames, settings }) {
  return {
    version: 2,
    teamNames: normalizeTeamNames(teamNames),
    settings: normalizeSettings(settings),
    archivedSeries,
    current,
  };
}

export function saveSeriesRecord({ archivedSeries, current, teamNames, settings }) {
  try {
    localStorage.setItem(
      STORAGE_SERIES,
      JSON.stringify(buildSeriesRecordPayload({ archivedSeries, current, teamNames, settings })),
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
  seriesMode,
  seriesLength,
  dateHistory,
  teamNames,
  currentSeriesScore,
  seriesHistory,
}) {
  const games = Array.isArray(seriesHistory) ? seriesHistory.map((g) => normalizeHistoryEntry(g)).filter(Boolean) : [];
  if (!games.length) return null;

  return normalizeArchivedSeries({
    id: createSeriesId(),
    startDate: startDate || formatDateYmd(),
    seriesMode,
    seriesLength,
    dateHistory,
    teamNames,
    finalScore: currentSeriesScore,
    games,
  });
}

export function getSeriesTeamName(series, side) {
  return series.teamNames?.[side] || (side === 'Blue' ? '藍方' : '紅方');
}

export function getGameTeamName(game, series, side) {
  const key = side === 'Blue' ? 'blueTeamName' : 'redTeamName';
  const fromGame = typeof game?.[key] === 'string' ? game[key].trim() : '';
  if (fromGame) return fromGame;
  return getSeriesTeamName(series, side);
}

export function getGameTeamNames(game, series) {
  return {
    Blue: getGameTeamName(game, series, 'Blue'),
    Red: getGameTeamName(game, series, 'Red'),
  };
}

export function getSeriesMatchupNames(series) {
  const seen = new Set();
  const names = [];
  for (const game of series.games ?? []) {
    for (const side of ['Blue', 'Red']) {
      const name = getGameTeamName(game, series, side);
      if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
      }
    }
  }
  if (names.length >= 2) return [names[0], names[1]];
  if (names.length === 1) return [names[0], getSeriesTeamName(series, 'Red')];
  return [getSeriesTeamName(series, 'Blue'), getSeriesTeamName(series, 'Red')];
}

function seriesMatchesTeamQuery(series, teamQ) {
  for (const game of series.games ?? []) {
    const blue = getGameTeamName(game, series, 'Blue').toLocaleLowerCase('zh-Hant');
    const red = getGameTeamName(game, series, 'Red').toLocaleLowerCase('zh-Hant');
    if (blue.includes(teamQ) || red.includes(teamQ)) return true;
  }
  return false;
}

export function getOurGameResult(game, ourSide) {
  if (!ourSide || !game.winner) return null;
  if (game.winner === ourSide) return 'win';
  return 'loss';
}

export function getWinningTeamName(game, series) {
  if (game.winner !== 'Blue' && game.winner !== 'Red') return null;
  return getGameTeamName(game, series, game.winner);
}

export function computeTeamSeriesScore(series) {
  const [teamA, teamB] = getSeriesMatchupNames(series);
  let scoreA = 0;
  let scoreB = 0;
  for (const game of series.games ?? []) {
    const winnerName = getWinningTeamName(game, series);
    if (!winnerName) continue;
    if (winnerName === teamA) scoreA += 1;
    else if (winnerName === teamB) scoreB += 1;
  }
  return { teamA, teamB, scoreA, scoreB };
}

/** @deprecated 僅保留相容；請用 computeTeamSeriesScore */
export function computeScoreFromGames(games) {
  const score = { Blue: 0, Red: 0 };
  for (const game of games ?? []) {
    if (game.winner === 'Blue') score.Blue += 1;
    else if (game.winner === 'Red') score.Red += 1;
  }
  return score;
}

export function getClinchingGame(series) {
  if (normalizeSeriesMode(series.seriesMode) === 'games') {
    return (series.games ?? [])[Math.min((series.games?.length ?? 0), series.seriesLength ?? 5) - 1] ?? null;
  }
  const needed = getWinsToWin(series.seriesLength ?? 5);
  const [teamA, teamB] = getSeriesMatchupNames(series);
  let scoreA = 0;
  let scoreB = 0;
  for (const game of series.games ?? []) {
    const winnerName = getWinningTeamName(game, series);
    if (!winnerName) continue;
    if (winnerName === teamA) scoreA += 1;
    else if (winnerName === teamB) scoreB += 1;
    if (scoreA >= needed || scoreB >= needed) return game;
  }
  return null;
}

export function getOurSeriesResult(series) {
  if (!isSeriesDecided(series)) return null;
  if (normalizeSeriesMode(series.seriesMode) === 'games') {
    const { teamA, teamB, scoreA, scoreB } = computeTeamSeriesScore(series);
    if (scoreA === scoreB) return null;
    const winnerName = scoreA > scoreB ? teamA : teamB;
    const clinch = getClinchingGame(series);
    if (!clinch?.ourSide) return null;
    const ourName = getGameTeamName(clinch, series, clinch.ourSide);
    return winnerName === ourName ? 'win' : 'loss';
  }
  const clinch = getClinchingGame(series);
  if (!clinch?.ourSide) return null;
  return clinch.winner === clinch.ourSide ? 'win' : 'loss';
}

export function isSeriesDecided(series) {
  if (normalizeSeriesMode(series.seriesMode) === 'games') {
    return (series.games ?? []).filter((game) => game.winner).length >= (series.seriesLength ?? 5);
  }
  const needed = getWinsToWin(series.seriesLength ?? 5);
  const { scoreA, scoreB } = computeTeamSeriesScore(series);
  return scoreA >= needed || scoreB >= needed;
}

function countOurGameResults(series) {
  let wins = 0;
  let losses = 0;
  for (const game of series.games ?? []) {
    const result = getOurGameResult(game, game.ourSide);
    if (result === 'win') wins += 1;
    else if (result === 'loss') losses += 1;
  }
  return { wins, losses };
}

export function computeBoSeriesStats(seriesList, { dateFilter = '', teamFilter = '' } = {}) {
  const teamQ = teamFilter.trim().toLocaleLowerCase('zh-Hant');
  let wins = 0;
  let losses = 0;

  for (const series of seriesList) {
    if (dateFilter && series.startDate !== dateFilter) continue;
    if (teamQ) {
      if (!seriesMatchesTeamQuery(series, teamQ)) continue;
    }
    if (!isSeriesDecided(series)) continue;
    if (normalizeSeriesMode(series.seriesMode) === 'games') {
      const gameResults = countOurGameResults(series);
      wins += gameResults.wins;
      losses += gameResults.losses;
      continue;
    }
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
    if (!seriesMatchesTeamQuery(series, teamQ)) return false;
  }

  if (resultFilter === 'all') return true;

  if (scopeFilter === 'series') {
    if (!isSeriesDecided(series)) return false;
    if (normalizeSeriesMode(series.seriesMode) === 'games') {
      return series.games.some((g) => g.ourSide && getOurGameResult(g, g.ourSide) === resultFilter);
    }
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
