export const TIMELINE_OBJECTIVES = [
  {
    id: 'baron',
    name: '巴龍',
    icon: '/icons/baron.png',
    aliases: ['baron', '巴龍'],
  },
  {
    id: 'dragon',
    name: '龍',
    icon: '/icons/dragon.png',
    aliases: ['dragon', '龍'],
  },
  {
    id: 'elderdragon',
    name: '遠古龍',
    icon: '/icons/elderdragon.png',
    aliases: ['elderdragon', '遠古龍'],
  },
  {
    id: 'bluebuff',
    name: '藍B',
    icon: '/icons/bluebuff.png',
    aliases: ['bluebuff', '藍B'],
  },
  {
    id: 'redbuff',
    name: '紅B',
    icon: '/icons/redbuff.png',
    aliases: ['redbuff', 'Redbuff', '紅B'],
  },
];

export function objectiveToMentionItem(objective) {
  return {
    kind: 'objective',
    id: objective.id,
    name: objective.name,
    icon: objective.icon,
    matchNames: objective.aliases,
  };
}

export function championToMentionItem(champion) {
  return {
    kind: 'champion',
    id: champion.id,
    name: champion.name,
    matchNames: [champion.name, champion.id],
  };
}

export function getTimelineMentionItems(gameChampions) {
  const objectives = TIMELINE_OBJECTIVES.map(objectiveToMentionItem);
  const champs = (gameChampions ?? []).map(championToMentionItem);
  return [...objectives, ...champs];
}
