import { useMemo } from 'react';
import { championToMentionItem, getTimelineMentionItems } from '../constants/timelineObjectives';
import { parseNoteMentions, parseMentionItems } from '../utils/championMention';

function MentionChip({ item, trigger, getChampionIconUrl }) {
  const iconSrc = item.kind === 'objective' ? item.icon : getChampionIconUrl(item.id);

  return (
    <span
      className="mention-chip"
      data-mention={`${trigger}${item.name}`}
      title={item.name}
      aria-label={item.name}
    >
      <img
        src={iconSrc}
        alt=""
        className="mention-chip-img"
        draggable={false}
        onError={(e) => {
          e.currentTarget.src = 'https://placehold.co/22x22/333/fff?text=?';
        }}
      />
    </span>
  );
}

export default function ChampionMentionDisplay({
  text,
  champions,
  gameChampions,
  getChampionIconUrl,
  mentionMode = 'note',
  className = 'text-sm text-gray-300 whitespace-pre-wrap',
}) {
  const parts = useMemo(() => {
    if (!text) return [];
    if (mentionMode === 'timeline') {
      return parseMentionItems(text, getTimelineMentionItems(gameChampions), { onlyAt: true });
    }
    const gameItems = (gameChampions ?? []).map(championToMentionItem);
    const allItems = (champions ?? []).map(championToMentionItem);
    return parseNoteMentions(text, gameChampions, champions, gameItems, allItems);
  }, [text, mentionMode, gameChampions, champions]);

  if (!text) {
    return <span className="text-sm text-gray-500">—</span>;
  }

  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.value}</span>;
        }
        if (part.type === 'mention') {
          return (
            <MentionChip
              key={index}
              item={part.item}
              trigger={part.trigger}
              getChampionIconUrl={getChampionIconUrl}
            />
          );
        }
        if (part.type === 'champion') {
          return (
            <MentionChip
              key={index}
              item={championToMentionItem(part.champion)}
              trigger={part.trigger}
              getChampionIconUrl={getChampionIconUrl}
            />
          );
        }
        return null;
      })}
    </p>
  );
}
