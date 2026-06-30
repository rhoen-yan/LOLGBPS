export const LANES = [
  { id: 'Top', label: '上', icon: '/lanes/top.png' },
  { id: 'Jungle', label: '野', icon: '/lanes/jungle.png' },
  { id: 'Mid', label: '中', icon: '/lanes/mid.png' },
  { id: 'Bot', label: '下', icon: '/lanes/bot.png' },
  { id: 'Support', label: '輔', icon: '/lanes/support.png' },
];

export const LANE_IDS = LANES.map((lane) => lane.id);

export function getLaneById(id) {
  return LANES.find((lane) => lane.id === id) ?? null;
}
