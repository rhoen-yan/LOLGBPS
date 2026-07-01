import { LANE_IDS } from '../constants/lanes';

export function emptyPickLanes() {
  return [null, null, null, null, null];
}

export function normalizePickLanes(picks, lanes) {
  const out = emptyPickLanes();
  const count = Math.min(Array.isArray(picks) ? picks.length : 0, 5);
  for (let i = 0; i < count; i++) {
    const lane = lanes?.[i];
    out[i] = LANE_IDS.includes(lane) ? lane : null;
  }
  return out;
}

export function normalizePickPlayers(picks, players) {
  const out = emptyPickLanes();
  const count = Math.min(Array.isArray(picks) ? picks.length : 0, 5);
  for (let i = 0; i < count; i++) {
    const player = typeof players?.[i] === 'string' ? players[i].trim() : '';
    out[i] = player || null;
  }
  return out;
}

export function isGameLaneComplete(game) {
  const isSideComplete = (picks, laneList) => {
    if (!Array.isArray(picks) || picks.length < 5) return false;
    for (let i = 0; i < 5; i++) {
      if (!picks[i] || !LANE_IDS.includes(laneList?.[i])) return false;
    }
    return true;
  };

  return (
    isSideComplete(game.bluePicks, game.bluePickLanes) &&
    isSideComplete(game.redPicks, game.redPickLanes)
  );
}

export function seriesHasIncompleteLanes(series) {
  return (series.games ?? []).some((game) => !isGameLaneComplete(game));
}
