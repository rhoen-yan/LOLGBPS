import { LANES } from '../constants/lanes';
import { isEmptyBanId } from '../constants';
import { isGameLaneComplete } from './pickLanes';
import { getGameTeamNames } from './seriesStorage';

export const ROLE_LABELS = LANES.map((lane) => lane.label);

const MATCHUP_DELTA_THRESHOLD = 5;
const MATCHUP_MIN_GAMES = 2;
const DEFAULT_TEAM_NAMES = { Blue: '藍方', Red: '紅方' };
const PLACEHOLDER_TEAM_NAMES = new Set([DEFAULT_TEAM_NAMES.Blue, DEFAULT_TEAM_NAMES.Red]);

export function getCurrentTeamNames(teamNames = DEFAULT_TEAM_NAMES) {
  return {
    Blue: teamNames?.Blue || DEFAULT_TEAM_NAMES.Blue,
    Red: teamNames?.Red || DEFAULT_TEAM_NAMES.Red,
  };
}

export function collectGameContexts(archivedSeries, currentHistory, currentTeamNames, currentStartDate = null) {
  const contexts = [];
  const currentSeriesStub = { teamNames: currentTeamNames ?? { Blue: '藍方', Red: '紅方' } };
  for (const series of archivedSeries ?? []) {
    for (const game of series.games ?? []) {
      contexts.push({
        game,
        teamNames: getGameTeamNames(game, series),
        startDate: series.startDate ?? null,
        seriesId: series.id,
        seriesLength: series.seriesLength ?? 5,
      });
    }
  }
  for (const game of currentHistory ?? []) {
    contexts.push({
      game,
      teamNames: getGameTeamNames(game, currentSeriesStub),
      startDate: currentStartDate,
      seriesId: 'current',
      seriesLength: null,
    });
  }
  return contexts;
}

export function collectTeamNameOptions(contexts) {
  const names = new Set();
  for (const { teamNames } of contexts) {
    if (teamNames.Blue) names.add(teamNames.Blue);
    if (teamNames.Red) names.add(teamNames.Red);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

export function resolveOurTeamSide(ctx, myTeamName = '') {
  const q = myTeamName?.trim();
  if (q) {
    if (ctx.teamNames.Blue === q) return 'Blue';
    if (ctx.teamNames.Red === q) return 'Red';
  }
  return ctx.game.ourSide ?? null;
}

export function collectOurTeamContexts(contexts, myTeamName = '') {
  const q = myTeamName?.trim();
  if (q) {
    return contexts.filter((ctx) => ctx.teamNames.Blue === q || ctx.teamNames.Red === q);
  }
  return collectOurSideContexts(contexts);
}

export function collectOpponentTeamOptions(contexts, myTeamName = '') {
  const names = new Set();
  for (const ctx of contexts) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (!ourSide) continue;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const name = ctx.teamNames[enemySide];
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

export function collectRivalTeamOptions(contexts, myTeamName = '') {
  const q = myTeamName?.trim();
  const names = new Set();
  for (const { teamNames } of contexts) {
    for (const name of [teamNames.Blue, teamNames.Red]) {
      if (!name || PLACEHOLDER_TEAM_NAMES.has(name)) continue;
      if (q && name === q) continue;
      names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

export function collectDateOptions(contexts) {
  const dates = new Set();
  for (const ctx of contexts) {
    if (ctx.startDate) dates.add(ctx.startDate);
  }
  return [...dates].sort((a, b) => b.localeCompare(a));
}

export function collectOurSideContexts(contexts) {
  return contexts.filter((ctx) => ctx.game.ourSide);
}

export function filterLaneCompleteContexts(contexts) {
  return contexts.filter((ctx) => isGameLaneComplete(ctx.game));
}

export function collectOurSideGames(archivedSeries, currentHistory) {
  const contexts = collectGameContexts(archivedSeries, currentHistory, getCurrentTeamNames());
  return filterLaneCompleteContexts(collectOurSideContexts(contexts)).map((ctx) => ctx.game);
}

function getSideBansPicks(game, side) {
  const bans = side === 'Blue' ? game.blueBans : game.redBans;
  const picks = side === 'Blue' ? game.bluePicks : game.redPicks;
  const pickLanes = side === 'Blue' ? game.bluePickLanes : game.redPickLanes;
  return { bans, picks, pickLanes };
}

function getPicksWithLanes(picks, pickLanes) {
  return (picks ?? [])
    .map((id, index) => ({ id, lane: pickLanes?.[index] ?? null }))
    .filter((entry) => entry.id && entry.lane);
}

export function resolveTeamSide(teamNames, teamName) {
  if (!teamName) return null;
  if (teamNames.Blue === teamName) return 'Blue';
  if (teamNames.Red === teamName) return 'Red';
  return null;
}

export function filterContextsByTeam(contexts, teamName) {
  if (!teamName) return contexts;
  return contexts.filter((ctx) => resolveTeamSide(ctx.teamNames, teamName) != null);
}

export function filterOurContextsVsTeam(contexts, teamName, myTeamName = '') {
  if (!teamName) return contexts;
  return contexts.filter((ctx) => {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (!ourSide) return false;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    return ctx.teamNames[enemySide] === teamName;
  });
}

export function applyOurTeamContextFilters(contexts, myTeamName = '', filters = {}) {
  let result = collectOurTeamContexts(contexts, myTeamName);

  if (filters.dateFilter) {
    result = result.filter((ctx) => ctx.startDate === filters.dateFilter);
  }
  if (filters.teamFilter) {
    result = filterOurContextsVsTeam(result, filters.teamFilter, myTeamName);
  }
  if (filters.sideFilter === 'Blue' || filters.sideFilter === 'Red') {
    result = result.filter((ctx) => resolveOurTeamSide(ctx, myTeamName) === filters.sideFilter);
  }
  if (filters.resultFilter === 'win' || filters.resultFilter === 'loss') {
    result = result.filter((ctx) => {
      const ourSide = resolveOurTeamSide(ctx, myTeamName);
      if (!ourSide) return false;
      const won = ctx.game.winner === ourSide;
      return filters.resultFilter === 'win' ? won : !won;
    });
  }
  if (filters.laneCompleteOnly !== false) {
    result = filterLaneCompleteContexts(result);
  }

  return result;
}

/** @deprecated 請用 applyOurTeamContextFilters */
export function applyOurContextFilters(ourContexts, filters = {}) {
  return applyOurTeamContextFilters(ourContexts, '', filters);
}

function withTrend(rows, baselineWinRate, totalGames, { gamesKey = 'games', winsKey = 'wins' } = {}) {
  return rows
    .map((row) => {
      const games = row[gamesKey];
      const wins = row[winsKey];
      const winRate = games > 0 ? (wins / games) * 100 : null;
      const delta = winRate != null && baselineWinRate != null ? winRate - baselineWinRate : null;
      let trend = null;
      if (games >= MATCHUP_MIN_GAMES && delta != null) {
        if (delta > MATCHUP_DELTA_THRESHOLD) trend = 'high';
        else if (delta < -MATCHUP_DELTA_THRESHOLD) trend = 'low';
        else trend = 'neutral';
      }
      return {
        ...row,
        winRate,
        delta,
        trend,
        encounterRate: totalGames > 0 ? (games / totalGames) * 100 : null,
      };
    })
    .sort((a, b) => {
      const aRank = a.games >= MATCHUP_MIN_GAMES ? Math.abs(a.delta ?? 0) : -1;
      const bRank = b.games >= MATCHUP_MIN_GAMES ? Math.abs(b.delta ?? 0) : -1;
      if (bRank !== aRank) return bRank - aRank;
      return b.games - a.games || String(a.id).localeCompare(String(b.id));
    });
}

function aggregateChampionStats(items, trackWins = true) {
  const totalGames = items.length;
  if (!totalGames) {
    return {
      totalGames: 0,
      champions: [],
      roles: LANES.map((lane, idx) => ({
        label: lane.label,
        laneId: lane.id,
        slot: idx + 1,
        totalGames: 0,
        champions: [],
      })),
    };
  }

  const champMap = new Map();
  const roleMaps = new Map(LANES.map((lane) => [lane.id, new Map()]));

  for (const { bans, picksWithLanes, won } of items) {
    for (const id of bans) {
      if (!id || isEmptyBanId(id)) continue;
      const entry = champMap.get(id) ?? { id, picks: 0, wins: 0, bans: 0 };
      entry.bans += 1;
      champMap.set(id, entry);
    }

    for (const { id, lane } of picksWithLanes) {
      const entry = champMap.get(id) ?? { id, picks: 0, wins: 0, bans: 0 };
      entry.picks += 1;
      if (trackWins && won) entry.wins += 1;
      champMap.set(id, entry);

      const roleMap = roleMaps.get(lane);
      if (!roleMap) continue;
      const roleEntry = roleMap.get(id) ?? { id, picks: 0, wins: 0 };
      roleEntry.picks += 1;
      if (trackWins && won) roleEntry.wins += 1;
      roleMap.set(id, roleEntry);
    }
  }

  const champions = [...champMap.values()]
    .map((c) => ({
      ...c,
      pickRate: (c.picks / totalGames) * 100,
      banRate: (c.bans / totalGames) * 100,
      winRate: trackWins && c.picks > 0 ? (c.wins / c.picks) * 100 : null,
    }))
    .filter((c) => c.picks > 0 || c.bans > 0)
    .sort((a, b) => b.picks - a.picks || b.bans - a.bans || a.id.localeCompare(b.id));

  const roles = LANES.map((lane, idx) => ({
    label: lane.label,
    laneId: lane.id,
    slot: idx + 1,
    totalGames,
    champions: [...(roleMaps.get(lane.id)?.values() ?? [])]
      .map((c) => ({
        ...c,
        pickRate: (c.picks / totalGames) * 100,
        winRate: trackWins && c.picks > 0 ? (c.wins / c.picks) * 100 : null,
      }))
      .sort((a, b) => b.picks - a.picks || a.id.localeCompare(b.id)),
  }));

  return { totalGames, champions, roles };
}

function buildOurTeamItems(contexts, myTeamName = '') {
  const items = [];
  for (const ctx of contexts) {
    const side = resolveOurTeamSide(ctx, myTeamName);
    if (!side) continue;
    const { game } = ctx;
    const { bans, picks, pickLanes } = getSideBansPicks(game, side);
    items.push({
      game,
      bans,
      picksWithLanes: getPicksWithLanes(picks, pickLanes),
      won: game.winner === side,
    });
  }
  return items;
}

function buildEnemyTeamItems(contexts, myTeamName = '') {
  const items = [];
  for (const ctx of contexts) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (!ourSide) continue;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const { game } = ctx;
    const { bans, picks, pickLanes } = getSideBansPicks(game, enemySide);
    items.push({
      game,
      bans,
      picksWithLanes: getPicksWithLanes(picks, pickLanes),
      won: game.winner === ourSide,
    });
  }
  return items;
}

export function computeOverview(contexts, myTeamName, filters) {
  const scoped = applyOurTeamContextFilters(contexts, myTeamName, { ...filters, laneCompleteOnly: false });
  const analyzed = applyOurTeamContextFilters(contexts, myTeamName, filters);
  const decided = analyzed.filter((ctx) => ctx.game.winner);
  let wins = 0;
  for (const ctx of decided) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (ourSide && ctx.game.winner === ourSide) wins++;
  }
  const losses = decided.length - wins;
  const opponents = new Set();
  for (const ctx of analyzed) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (!ourSide) continue;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    opponents.add(ctx.teamNames[enemySide]);
  }

  return {
    myTeamName: myTeamName?.trim() || null,
    totalOurGames: scoped.length,
    analyzedGames: analyzed.length,
    excludedLaneGames: scoped.length - filterLaneCompleteContexts(scoped).length,
    wins,
    losses,
    winRate: decided.length > 0 ? (wins / decided.length) * 100 : null,
    opponentCount: opponents.size,
  };
}

export function computeOurSideAnalytics(games) {
  const items = games.map((game) => {
    const { bans, picks, pickLanes } = getSideBansPicks(game, game.ourSide);
    const won = game.winner === game.ourSide;
    return { bans, picksWithLanes: getPicksWithLanes(picks, pickLanes), won };
  });
  return aggregateChampionStats(items, true);
}

export function computeOurSideSplit(contexts, myTeamName = '') {
  const blueItems = [];
  const redItems = [];
  for (const ctx of contexts) {
    const side = resolveOurTeamSide(ctx, myTeamName);
    if (!side) continue;
    const { game } = ctx;
    const { bans, picks, pickLanes } = getSideBansPicks(game, side);
    const item = {
      bans,
      picksWithLanes: getPicksWithLanes(picks, pickLanes),
      won: game.winner === side,
    };
    if (side === 'Blue') blueItems.push(item);
    else redItems.push(item);
  }
  return {
    Blue: aggregateChampionStats(blueItems, true),
    Red: aggregateChampionStats(redItems, true),
  };
}

export function computeOurChampionLaneStats(contexts, myTeamName = '') {
  const items = buildOurTeamItems(contexts, myTeamName);
  const totalGames = items.length;
  if (!totalGames) return { totalGames: 0, rows: [] };

  const map = new Map();
  for (const { picksWithLanes, won } of items) {
    for (const { id, lane } of picksWithLanes) {
      const key = `${id}:${lane}`;
      const entry = map.get(key) ?? { id, lane, picks: 0, wins: 0 };
      entry.picks += 1;
      if (won) entry.wins += 1;
      map.set(key, entry);
    }
  }

  const rows = [...map.values()]
    .map((row) => ({
      ...row,
      pickRate: (row.picks / totalGames) * 100,
      winRate: row.picks > 0 ? (row.wins / row.picks) * 100 : null,
    }))
    .sort((a, b) => b.picks - a.picks || a.lane.localeCompare(b.lane) || a.id.localeCompare(b.id));

  return { totalGames, rows };
}

function buildChampPrimaryLaneMap(items) {
  const champLaneCounts = new Map();
  for (const { picksWithLanes } of items) {
    for (const { id, lane } of picksWithLanes) {
      if (!champLaneCounts.has(id)) champLaneCounts.set(id, new Map());
      const laneMap = champLaneCounts.get(id);
      laneMap.set(lane, (laneMap.get(lane) ?? 0) + 1);
    }
  }
  return champLaneCounts;
}

function resolvePrimaryLane(champId, champLaneCounts) {
  const laneMap = champLaneCounts.get(champId);
  if (!laneMap) return null;
  let best = null;
  let bestCount = 0;
  for (const [lane, count] of laneMap) {
    if (count > bestCount) {
      best = lane;
      bestCount = count;
    }
  }
  return best;
}

export function computeOurBanRoleStats(contexts, myTeamName = '') {
  const items = buildOurTeamItems(contexts, myTeamName);
  const totalGames = items.length;
  if (!totalGames) {
    return {
      totalGames: 0,
      roles: LANES.map((lane, idx) => ({
        label: lane.label,
        laneId: lane.id,
        slot: idx + 1,
        totalGames: 0,
        laneRate: null,
        champions: [],
      })),
    };
  }

  const champLaneCounts = buildChampPrimaryLaneMap(items);
  const roleMaps = new Map(LANES.map((lane) => [lane.id, new Map()]));
  const gamesWithLaneBan = new Map(LANES.map((lane) => [lane.id, 0]));

  for (const { bans } of items) {
    const lanesThisGame = new Set();
    for (const id of bans) {
      if (!id || isEmptyBanId(id)) continue;
      const lane = resolvePrimaryLane(id, champLaneCounts);
      if (!lane) continue;
      lanesThisGame.add(lane);
      const roleMap = roleMaps.get(lane);
      const entry = roleMap.get(id) ?? { id, bans: 0 };
      entry.bans += 1;
      roleMap.set(id, entry);
    }
    for (const lane of lanesThisGame) {
      gamesWithLaneBan.set(lane, (gamesWithLaneBan.get(lane) ?? 0) + 1);
    }
  }

  const roles = LANES.map((lane, idx) => ({
    label: lane.label,
    laneId: lane.id,
    slot: idx + 1,
    totalGames,
    laneRate: ((gamesWithLaneBan.get(lane.id) ?? 0) / totalGames) * 100,
    champions: [...(roleMaps.get(lane.id)?.values() ?? [])]
      .map((c) => ({
        ...c,
        banRate: (c.bans / totalGames) * 100,
      }))
      .sort((a, b) => b.bans - a.bans || a.id.localeCompare(b.id)),
  }));

  return { totalGames, roles };
}

export function filterContextsForTeamAnalysis(contexts, teamName, myTeamName = '', filters = {}) {
  const target = teamName?.trim();
  const q = myTeamName?.trim();
  if (!target) return [];

  let result = contexts.filter((ctx) => {
    const hasTarget = ctx.teamNames.Blue === target || ctx.teamNames.Red === target;
    if (!hasTarget) return false;
    if (!q) return true;
    return ctx.teamNames.Blue === q || ctx.teamNames.Red === q;
  });

  return applyOurTeamContextFilters(result, myTeamName, { ...filters, teamFilter: '' });
}

export function computeTeamAnalytics(contexts, teamName, myTeamName = '', filters = {}) {
  const scoped = filterContextsForTeamAnalysis(contexts, teamName, myTeamName, filters);
  const items = [];
  let wins = 0;

  for (const ctx of scoped) {
    const side = resolveTeamSide(ctx.teamNames, teamName);
    if (!side) continue;
    const { bans, picks, pickLanes } = getSideBansPicks(ctx.game, side);
    const won = ctx.game.winner === side;
    if (won) wins += 1;
    items.push({
      bans,
      picksWithLanes: getPicksWithLanes(picks, pickLanes),
      won,
    });
  }

  const totalGames = items.length;
  const stats = aggregateChampionStats(items, true);

  return {
    ...stats,
    wins,
    losses: totalGames - wins,
    teamWinRate: totalGames > 0 ? (wins / totalGames) * 100 : null,
  };
}

export function computeEnemyOverview(contexts, myTeamName = '') {
  const items = buildEnemyTeamItems(contexts, myTeamName);
  return aggregateChampionStats(items, false);
}

export function computeMatchupAnalytics(contexts, myTeamName = '') {
  const scoped = collectOurTeamContexts(contexts, myTeamName);
  const laneComplete = filterLaneCompleteContexts(scoped);
  let totalWins = 0;
  const totalGames = laneComplete.length;

  if (!totalGames) {
    return { totalGames: 0, baselineWinRate: null, matchups: [] };
  }

  const map = new Map();

  for (const ctx of laneComplete) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (!ourSide) continue;
    const { game } = ctx;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const { picks, pickLanes } = getSideBansPicks(game, enemySide);
    const enemyPicks = getPicksWithLanes(picks, pickLanes);
    const won = game.winner === ourSide;
    if (won) totalWins += 1;

    for (const { id } of enemyPicks) {
      const entry = map.get(id) ?? { id, games: 0, wins: 0 };
      entry.games += 1;
      if (won) entry.wins += 1;
      map.set(id, entry);
    }
  }

  const baselineWinRate = (totalWins / totalGames) * 100;
  const matchups = withTrend([...map.values()], baselineWinRate, totalGames);

  return { totalGames, baselineWinRate, matchups };
}

export function computeEnemyLaneMatchupAnalytics(contexts, myTeamName = '') {
  const scoped = collectOurTeamContexts(contexts, myTeamName);
  const laneComplete = filterLaneCompleteContexts(scoped);
  let totalWins = 0;
  const totalGames = laneComplete.length;
  if (!totalGames) return { totalGames: 0, baselineWinRate: null, matchups: [] };

  const map = new Map();
  for (const ctx of laneComplete) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (!ourSide) continue;
    const { game } = ctx;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const { picks, pickLanes } = getSideBansPicks(game, enemySide);
    const enemyPicks = getPicksWithLanes(picks, pickLanes);
    const won = game.winner === ourSide;
    if (won) totalWins += 1;

    for (const { id, lane } of enemyPicks) {
      const key = `${id}:${lane}`;
      const entry = map.get(key) ?? { id, lane, games: 0, wins: 0 };
      entry.games += 1;
      if (won) entry.wins += 1;
      map.set(key, entry);
    }
  }

  const baselineWinRate = (totalWins / totalGames) * 100;
  const matchups = withTrend([...map.values()], baselineWinRate, totalGames).map((row) => ({
    ...row,
    key: `${row.id}:${row.lane}`,
  }));

  return { totalGames, baselineWinRate, matchups };
}

export function computeBanMatchupAnalytics(contexts, myTeamName = '', target = 'our') {
  const scoped = collectOurTeamContexts(contexts, myTeamName);
  const laneComplete = filterLaneCompleteContexts(scoped);
  let totalWins = 0;
  const totalGames = laneComplete.length;
  if (!totalGames) return { totalGames: 0, baselineWinRate: null, matchups: [] };

  const map = new Map();
  for (const ctx of laneComplete) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (!ourSide) continue;
    const { game } = ctx;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const won = game.winner === ourSide;
    if (won) totalWins += 1;

    const bans =
      target === 'our'
        ? getSideBansPicks(game, ourSide).bans
        : getSideBansPicks(game, enemySide).bans;

    for (const id of bans) {
      if (!id || isEmptyBanId(id)) continue;
      const entry = map.get(id) ?? { id, games: 0, wins: 0 };
      entry.games += 1;
      if (won) entry.wins += 1;
      map.set(id, entry);
    }
  }

  const baselineWinRate = (totalWins / totalGames) * 100;
  const matchups = withTrend([...map.values()], baselineWinRate, totalGames);

  return { totalGames, baselineWinRate, matchups };
}

export function getEnemyTeamName(ctx, myTeamName = '') {
  const ourSide = resolveOurTeamSide(ctx, myTeamName);
  if (!ourSide) return null;
  const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
  return ctx.teamNames[enemySide];
}

export function groupOurContextsByOpponent(contexts, myTeamName = '') {
  const map = new Map();
  for (const ctx of contexts) {
    const teamName = getEnemyTeamName(ctx, myTeamName);
    if (!teamName) continue;
    if (!map.has(teamName)) map.set(teamName, []);
    map.get(teamName).push(ctx);
  }
  return [...map.entries()]
    .map(([teamName, groupContexts]) => ({ teamName, contexts: groupContexts }))
    .sort((a, b) => b.contexts.length - a.contexts.length || a.teamName.localeCompare(b.teamName, 'zh-Hant'));
}

function computeOpponentSummary(contexts, myTeamName = '') {
  const totalGames = contexts.length;
  let wins = 0;
  for (const ctx of contexts) {
    const ourSide = resolveOurTeamSide(ctx, myTeamName);
    if (ourSide && ctx.game.winner === ourSide) wins += 1;
  }
  return {
    totalGames,
    wins,
    losses: totalGames - wins,
    winRate: totalGames > 0 ? (wins / totalGames) * 100 : null,
  };
}

export function computeOpponentGroupAnalytics(contexts, myTeamName = '') {
  return {
    summary: computeOpponentSummary(contexts, myTeamName),
    enemy: computeEnemyOverview(contexts, myTeamName),
    enemyLanePresence: computeLanePresenceStats(contexts, myTeamName, 'enemy'),
    matchupPick: computeMatchupAnalytics(contexts, myTeamName),
    matchupEnemyLane: computeEnemyLaneMatchupAnalytics(contexts, myTeamName),
    enemyBan: computeBanMatchupAnalytics(contexts, myTeamName, 'enemy'),
  };
}

export function computeEnemyGroupedAnalytics(contexts, myTeamName = '') {
  return groupOurContextsByOpponent(contexts, myTeamName).map(({ teamName, contexts: groupContexts }) => ({
    teamName,
    ...computeOpponentGroupAnalytics(groupContexts, myTeamName),
  }));
}

export function computeLanePresenceStats(contexts, myTeamName = '', side = 'our') {
  const items =
    side === 'our'
      ? buildOurTeamItems(contexts, myTeamName)
      : buildEnemyTeamItems(contexts, myTeamName);
  const totalGames = items.length;
  if (!totalGames) {
    return LANES.map((lane) => ({ laneId: lane.id, label: lane.label, picks: 0, pickRate: null }));
  }

  const counts = new Map(LANES.map((lane) => [lane.id, 0]));
  for (const { picksWithLanes } of items) {
    for (const { lane } of picksWithLanes) {
      counts.set(lane, (counts.get(lane) ?? 0) + 1);
    }
  }

  return LANES.map((lane) => {
    const picks = counts.get(lane.id) ?? 0;
    return {
      laneId: lane.id,
      label: lane.label,
      picks,
      pickRate: (picks / totalGames) * 100,
    };
  });
}

export function applyContextFilters(contexts, filters = {}) {
  let result = contexts;
  if (filters.dateFilter) {
    result = result.filter((ctx) => ctx.startDate === filters.dateFilter);
  }
  if (filters.laneCompleteOnly !== false) {
    result = filterLaneCompleteContexts(result);
  }
  return result;
}

export function computeFullAnalytics(contexts, allContexts, filters, analyzeTeam = '', myTeamName = '') {
  const analyzedOur = applyOurTeamContextFilters(contexts, myTeamName, filters);
  const ourItems = buildOurTeamItems(analyzedOur, myTeamName);
  const teamName = analyzeTeam || null;

  return {
    overview: computeOverview(contexts, myTeamName, filters),
    our: aggregateChampionStats(ourItems, true),
    ourLanePresence: computeLanePresenceStats(analyzedOur, myTeamName, 'our'),
    ourBanRoles: computeOurBanRoleStats(analyzedOur, myTeamName),
    ourSplit: computeOurSideSplit(analyzedOur, myTeamName),
    ourChampionLane: computeOurChampionLaneStats(analyzedOur, myTeamName),
    enemy: computeEnemyOverview(analyzedOur, myTeamName),
    enemyLanePresence: computeLanePresenceStats(analyzedOur, myTeamName, 'enemy'),
    enemyGrouped: computeEnemyGroupedAnalytics(analyzedOur, myTeamName),
    matchupPick: computeMatchupAnalytics(analyzedOur, myTeamName),
    matchupEnemyLane: computeEnemyLaneMatchupAnalytics(analyzedOur, myTeamName),
    ourBan: computeBanMatchupAnalytics(analyzedOur, myTeamName, 'our'),
    enemyBan: computeBanMatchupAnalytics(analyzedOur, myTeamName, 'enemy'),
    team: teamName ? computeTeamAnalytics(contexts, teamName, myTeamName, filters) : null,
  };
}

export function formatRate(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

export function formatDelta(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}
