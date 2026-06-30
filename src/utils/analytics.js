import { LANES } from '../constants/lanes';
import { isGameLaneComplete } from './pickLanes';

export const ROLE_LABELS = LANES.map((lane) => lane.label);

const MATCHUP_DELTA_THRESHOLD = 5;
const MATCHUP_MIN_GAMES = 2;
const DEFAULT_TEAM_NAMES = { Blue: '藍方', Red: '紅方' };

export function getCurrentTeamNames(teamNames = DEFAULT_TEAM_NAMES) {
  return {
    Blue: teamNames?.Blue || DEFAULT_TEAM_NAMES.Blue,
    Red: teamNames?.Red || DEFAULT_TEAM_NAMES.Red,
  };
}

export function collectGameContexts(archivedSeries, currentHistory, currentTeamNames, currentStartDate = null) {
  const contexts = [];
  for (const series of archivedSeries ?? []) {
    const teamNames = series.teamNames ?? { Blue: '藍方', Red: '紅方' };
    for (const game of series.games ?? []) {
      contexts.push({
        game,
        teamNames,
        startDate: series.startDate ?? null,
        seriesId: series.id,
        seriesLength: series.seriesLength ?? 5,
      });
    }
  }
  const teamNames = currentTeamNames ?? { Blue: '藍方', Red: '紅方' };
  for (const game of currentHistory ?? []) {
    contexts.push({
      game,
      teamNames,
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

export function collectOpponentTeamOptions(ourContexts) {
  const names = new Set();
  for (const ctx of ourContexts) {
    const ourSide = ctx.game.ourSide;
    if (!ourSide) continue;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const name = ctx.teamNames[enemySide];
    if (name) names.add(name);
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

export function filterOurContextsVsTeam(ourContexts, teamName) {
  if (!teamName) return ourContexts;
  return ourContexts.filter((ctx) => {
    const ourSide = ctx.game.ourSide;
    if (!ourSide) return false;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    return ctx.teamNames[enemySide] === teamName;
  });
}

export function applyOurContextFilters(ourContexts, filters = {}) {
  let result = ourContexts;

  if (filters.dateFilter) {
    result = result.filter((ctx) => ctx.startDate === filters.dateFilter);
  }
  if (filters.teamFilter) {
    result = filterOurContextsVsTeam(result, filters.teamFilter);
  }
  if (filters.sideFilter === 'Blue' || filters.sideFilter === 'Red') {
    result = result.filter((ctx) => ctx.game.ourSide === filters.sideFilter);
  }
  if (filters.resultFilter === 'win' || filters.resultFilter === 'loss') {
    result = result.filter((ctx) => {
      const won = ctx.game.winner === ctx.game.ourSide;
      return filters.resultFilter === 'win' ? won : !won;
    });
  }
  if (filters.laneCompleteOnly !== false) {
    result = filterLaneCompleteContexts(result);
  }

  return result;
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
      if (!id) continue;
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

function buildOurItems(contexts) {
  return contexts.map(({ game }) => {
    const { bans, picks, pickLanes } = getSideBansPicks(game, game.ourSide);
    const won = game.winner === game.ourSide;
    return {
      game,
      bans,
      picksWithLanes: getPicksWithLanes(picks, pickLanes),
      won,
    };
  });
}

function buildEnemyItems(contexts) {
  return contexts.map(({ game }) => {
    const ourSide = game.ourSide;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const { bans, picks, pickLanes } = getSideBansPicks(game, enemySide);
    const won = game.winner === ourSide;
    return {
      game,
      bans,
      picksWithLanes: getPicksWithLanes(picks, pickLanes),
      won,
    };
  });
}

export function computeOverview(ourContexts, filters) {
  const scoped = applyOurContextFilters(ourContexts, { ...filters, laneCompleteOnly: false });
  const analyzed = applyOurContextFilters(ourContexts, filters);
  let wins = 0;
  for (const { game } of analyzed) {
    if (game.winner === game.ourSide) wins++;
  }
  const losses = analyzed.length - wins;
  const opponents = new Set();
  for (const ctx of analyzed) {
    const enemySide = ctx.game.ourSide === 'Blue' ? 'Red' : 'Blue';
    opponents.add(ctx.teamNames[enemySide]);
  }

  return {
    totalOurGames: scoped.length,
    analyzedGames: analyzed.length,
    excludedLaneGames: scoped.length - filterLaneCompleteContexts(scoped).length,
    wins,
    losses,
    winRate: analyzed.length > 0 ? (wins / analyzed.length) * 100 : null,
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

export function computeOurSideSplit(contexts) {
  const items = buildOurItems(contexts);
  const blueItems = items.filter((item) => item.game.ourSide === 'Blue');
  const redItems = items.filter((item) => item.game.ourSide === 'Red');
  return {
    Blue: aggregateChampionStats(blueItems, true),
    Red: aggregateChampionStats(redItems, true),
  };
}

export function computeOurChampionLaneStats(contexts) {
  const items = buildOurItems(contexts);
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

export function computeTeamAnalytics(contexts, teamName) {
  const laneComplete = filterLaneCompleteContexts(filterContextsByTeam(contexts, teamName));
  const items = [];
  for (const ctx of laneComplete) {
    const side = resolveTeamSide(ctx.teamNames, teamName);
    if (!side) continue;
    const { bans, picks, pickLanes } = getSideBansPicks(ctx.game, side);
    items.push({
      bans,
      picksWithLanes: getPicksWithLanes(picks, pickLanes),
      won: false,
    });
  }
  return aggregateChampionStats(items, false);
}

export function computeEnemyOverview(contexts) {
  const items = buildEnemyItems(contexts);
  return aggregateChampionStats(items, false);
}

export function computeMatchupAnalytics(ourContexts) {
  const contexts = filterLaneCompleteContexts(ourContexts);
  let totalWins = 0;
  const totalGames = contexts.length;

  if (!totalGames) {
    return { totalGames: 0, baselineWinRate: null, matchups: [] };
  }

  const map = new Map();

  for (const { game } of contexts) {
    const ourSide = game.ourSide;
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

export function computeEnemyLaneMatchupAnalytics(ourContexts) {
  const contexts = filterLaneCompleteContexts(ourContexts);
  let totalWins = 0;
  const totalGames = contexts.length;
  if (!totalGames) return { totalGames: 0, baselineWinRate: null, matchups: [] };

  const map = new Map();
  for (const { game } of contexts) {
    const ourSide = game.ourSide;
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

export function computeBanMatchupAnalytics(ourContexts, target = 'our') {
  const contexts = filterLaneCompleteContexts(ourContexts);
  let totalWins = 0;
  const totalGames = contexts.length;
  if (!totalGames) return { totalGames: 0, baselineWinRate: null, matchups: [] };

  const map = new Map();
  for (const { game } of contexts) {
    const ourSide = game.ourSide;
    const enemySide = ourSide === 'Blue' ? 'Red' : 'Blue';
    const won = game.winner === ourSide;
    if (won) totalWins += 1;

    const bans =
      target === 'our'
        ? getSideBansPicks(game, ourSide).bans
        : getSideBansPicks(game, enemySide).bans;

    for (const id of bans) {
      if (!id) continue;
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

export function getEnemyTeamName(ctx) {
  const enemySide = ctx.game.ourSide === 'Blue' ? 'Red' : 'Blue';
  return ctx.teamNames[enemySide];
}

export function groupOurContextsByOpponent(contexts) {
  const map = new Map();
  for (const ctx of contexts) {
    const teamName = getEnemyTeamName(ctx);
    if (!map.has(teamName)) map.set(teamName, []);
    map.get(teamName).push(ctx);
  }
  return [...map.entries()]
    .map(([teamName, groupContexts]) => ({ teamName, contexts: groupContexts }))
    .sort((a, b) => b.contexts.length - a.contexts.length || a.teamName.localeCompare(b.teamName, 'zh-Hant'));
}

function computeOpponentSummary(contexts) {
  const totalGames = contexts.length;
  let wins = 0;
  for (const { game } of contexts) {
    if (game.winner === game.ourSide) wins += 1;
  }
  return {
    totalGames,
    wins,
    losses: totalGames - wins,
    winRate: totalGames > 0 ? (wins / totalGames) * 100 : null,
  };
}

export function computeOpponentGroupAnalytics(contexts) {
  return {
    summary: computeOpponentSummary(contexts),
    enemy: computeEnemyOverview(contexts),
    enemyLanePresence: computeLanePresenceStats(contexts, 'enemy'),
    matchupPick: computeMatchupAnalytics(contexts),
    matchupEnemyLane: computeEnemyLaneMatchupAnalytics(contexts),
    enemyBan: computeBanMatchupAnalytics(contexts, 'enemy'),
  };
}

export function computeEnemyGroupedAnalytics(contexts) {
  return groupOurContextsByOpponent(contexts).map(({ teamName, contexts: groupContexts }) => ({
    teamName,
    ...computeOpponentGroupAnalytics(groupContexts),
  }));
}

export function computeLanePresenceStats(contexts, side = 'our') {
  const items = side === 'our' ? buildOurItems(contexts) : buildEnemyItems(contexts);
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

export function computeFullAnalytics(ourContexts, allContexts, filters, analyzeTeam = '') {
  const analyzedOur = applyOurContextFilters(ourContexts, filters);
  const filteredAll = applyContextFilters(allContexts, filters);
  const games = analyzedOur.map((ctx) => ctx.game);
  const teamName = analyzeTeam || null;

  return {
    overview: computeOverview(ourContexts, filters),
    our: computeOurSideAnalytics(games),
    ourSplit: computeOurSideSplit(analyzedOur),
    ourChampionLane: computeOurChampionLaneStats(analyzedOur),
    enemy: computeEnemyOverview(analyzedOur),
    enemyLanePresence: computeLanePresenceStats(analyzedOur, 'enemy'),
    enemyGrouped: computeEnemyGroupedAnalytics(analyzedOur),
    matchupPick: computeMatchupAnalytics(analyzedOur),
    matchupEnemyLane: computeEnemyLaneMatchupAnalytics(analyzedOur),
    ourBan: computeBanMatchupAnalytics(analyzedOur, 'our'),
    enemyBan: computeBanMatchupAnalytics(analyzedOur, 'enemy'),
    team: teamName ? computeTeamAnalytics(filteredAll, teamName) : null,
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
