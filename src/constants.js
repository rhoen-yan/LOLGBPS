export const STORAGE_BLUE = 'bp-blue-team-name';
export const STORAGE_RED = 'bp-red-team-name';
export const EDIT_PASSWORD = 'ssheep';
export const DEFAULT_DDRAGON_VERSION = '14.19.1';
export const SERIES_LENGTH_OPTIONS = [1, 2, 3, 4, 5];

export function getWinsToWin(seriesLength) {
  return Math.floor(seriesLength / 2) + 1;
}

export function formatSeriesLabel(seriesLength) {
  return `BO${seriesLength}`;
}

export const DRAFT_FLOW = [
  { step: 1, type: 'Ban', team: 'Blue', description: 'B1' },
  { step: 2, type: 'Ban', team: 'Red', description: 'B1' },
  { step: 3, type: 'Ban', team: 'Blue', description: 'B2' },
  { step: 4, type: 'Ban', team: 'Red', description: 'B2' },
  { step: 5, type: 'Ban', team: 'Blue', description: 'B3' },
  { step: 6, type: 'Ban', team: 'Red', description: 'B3' },
  { step: 7, type: 'Pick', team: 'Blue', description: 'P1' },
  { step: 8, type: 'Pick', team: 'Red', description: 'P1' },
  { step: 9, type: 'Pick', team: 'Red', description: 'P2' },
  { step: 10, type: 'Pick', team: 'Blue', description: 'P2' },
  { step: 11, type: 'Pick', team: 'Blue', description: 'P3' },
  { step: 12, type: 'Pick', team: 'Red', description: 'P3' },
  { step: 13, type: 'Ban', team: 'Red', description: 'B4' },
  { step: 14, type: 'Ban', team: 'Blue', description: 'B4' },
  { step: 15, type: 'Ban', team: 'Red', description: 'B5' },
  { step: 16, type: 'Ban', team: 'Blue', description: 'B5' },
  { step: 17, type: 'Pick', team: 'Red', description: 'P4' },
  { step: 18, type: 'Pick', team: 'Blue', description: 'P4' },
  { step: 19, type: 'Pick', team: 'Blue', description: 'P5' },
  { step: 20, type: 'Pick', team: 'Red', description: 'P5' },
];

export function createEmptyBpState() {
  return {
    currentStep: 0,
    selectedChampions: [],
    banCounts: { Blue: 0, Red: 0 },
    pickCounts: { Blue: 0, Red: 0 },
    teamData: {
      Blue: { bans: [], picks: [] },
      Red: { bans: [], picks: [] },
    },
  };
}

export function getTeamArray(teamData, team, type) {
  return type === 'bans' ? teamData[team].bans : teamData[team].picks;
}

export function slotId(team, type, index) {
  return `${team.toLowerCase()}-${type}-${index}`;
}

export function parseSlotId(id) {
  const [teamRaw, type, indexRaw] = id.split('-');
  return {
    team: teamRaw.charAt(0).toUpperCase() + teamRaw.slice(1),
    type,
    index: parseInt(indexRaw, 10),
  };
}
