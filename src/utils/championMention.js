import { isEmptyBanId } from '../constants';

export function findChampionMentionAt(text, startIndex, champions) {
  let best = null;
  for (const champ of champions) {
    if (text.slice(startIndex).startsWith(champ.name)) {
      if (!best || champ.name.length > best.name.length) best = champ;
    }
  }
  return best;
}

export function findMentionItemAt(text, startIndex, items) {
  let best = null;
  let bestLen = 0;
  for (const item of items) {
    for (const name of item.matchNames) {
      if (text.slice(startIndex).startsWith(name) && name.length > bestLen) {
        best = { item, matchedName: name };
        bestLen = name.length;
      }
    }
  }
  return best;
}

function findNextMentionTrigger(text, start, { onlyAt = false } = {}) {
  const at = text.indexOf('@', start);
  if (onlyAt) {
    return at === -1 ? null : { idx: at, trigger: '@' };
  }
  const bang = text.indexOf('!', start);
  if (at === -1 && bang === -1) return null;
  if (at === -1) return { idx: bang, trigger: '!' };
  if (bang === -1) return { idx: at, trigger: '@' };
  return at <= bang ? { idx: at, trigger: '@' } : { idx: bang, trigger: '!' };
}

export function parseChampionMentions(text, champions) {
  if (!text) return [];
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const next = findNextMentionTrigger(text, i);
    if (!next) {
      parts.push({ type: 'text', value: text.slice(i) });
      break;
    }
    if (next.idx > i) parts.push({ type: 'text', value: text.slice(i, next.idx) });
    const champ = findChampionMentionAt(text, next.idx + 1, champions);
    if (champ) {
      parts.push({ type: 'champion', champion: champ, trigger: next.trigger });
      i = next.idx + 1 + champ.name.length;
    } else {
      parts.push({ type: 'text', value: next.trigger });
      i = next.idx + 1;
    }
  }
  return parts;
}

export function parseMentionItems(text, items, { onlyAt = false } = {}) {
  if (!text) return [];
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const next = findNextMentionTrigger(text, i, { onlyAt });
    if (!next) {
      parts.push({ type: 'text', value: text.slice(i) });
      break;
    }
    if (next.idx > i) parts.push({ type: 'text', value: text.slice(i, next.idx) });
    const match = findMentionItemAt(text, next.idx + 1, items);
    if (match) {
      parts.push({ type: 'mention', item: match.item, trigger: next.trigger });
      i = next.idx + 1 + match.matchedName.length;
    } else {
      parts.push({ type: 'text', value: next.trigger });
      i = next.idx + 1;
    }
  }
  return parts;
}

export function resolveExactMentionItem(text, mention, pool) {
  const match = findMentionItemAt(text, mention.atIdx + 1, pool);
  if (!match || match.matchedName !== mention.query) return null;
  return match.item;
}

export function getMentionContext(text, cursorPos, { onlyAt = false, resolvePool } = {}) {
  const before = text.slice(0, cursorPos);
  for (let i = before.length - 1; i >= 0; i--) {
    const ch = before[i];
    if (onlyAt) {
      if (ch !== '@') continue;
      const query = before.slice(i + 1);
      if (/[\s\n]/.test(query)) return null;
      if (resolvePool) {
        const pool = resolvePool('@');
        if (isCompleteMentionToken(before, i, before.length, pool)) return null;
      }
      return { atIdx: i, query, trigger: '@' };
    }
    if (ch !== '@' && ch !== '!' && ch !== '！') continue;
    const trigger = ch === '！' ? '!' : ch;
    const query = before.slice(i + 1);
    if (/[\s\n]/.test(query)) return null;
    if (resolvePool) {
      const pool = resolvePool(trigger);
      if (isCompleteMentionToken(before, i, before.length, pool)) return null;
    }
    return { atIdx: i, query, trigger };
  }
  return null;
}

function isCompleteMentionToken(text, atIdx, cursorPos, pool) {
  if (!pool?.length || cursorPos <= atIdx + 1) return false;
  const match = findMentionItemAt(text, atIdx + 1, pool);
  if (!match) return false;
  return atIdx + 1 + match.matchedName.length === cursorPos;
}

export function parseNoteMentions(text, gameChampions, allChampions, gameItems, allItems) {
  if (!text) return [];
  const parts = [];
  let i = 0;
  while (i < text.length) {
    const next = findNextMentionTrigger(text, i);
    if (!next) {
      parts.push({ type: 'text', value: text.slice(i) });
      break;
    }
    if (next.idx > i) parts.push({ type: 'text', value: text.slice(i, next.idx) });
    const pool = next.trigger === '!' ? allItems : gameItems;
    const match = findMentionItemAt(text, next.idx + 1, pool);
    if (match) {
      parts.push({ type: 'mention', item: match.item, trigger: next.trigger });
      i = next.idx + 1 + match.matchedName.length;
    } else {
      parts.push({ type: 'text', value: next.trigger });
      i = next.idx + 1;
    }
  }
  return parts;
}

export function filterChampionsForMention(champions, query, limit = 12) {
  if (!query) return champions.slice(0, limit);
  const q = query.toLocaleLowerCase('zh-Hant');
  return champions
    .filter(
      (c) =>
        c.name.toLocaleLowerCase('zh-Hant').includes(q) ||
        c.id.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

export function filterMentionItems(items, query, limit = 12) {
  if (!query) return items.slice(0, limit);
  const q = query.toLocaleLowerCase('zh-Hant');
  return items
    .filter((item) =>
      item.matchNames.some(
        (name) =>
          name.toLocaleLowerCase('zh-Hant').includes(q) || name.toLowerCase().includes(q),
      ),
    )
    .slice(0, limit);
}

export function getGameChampionsFromIds(ids, allChampions) {
  const idSet = new Set(ids);
  return allChampions.filter((c) => idSet.has(c.id));
}

export function collectGameChampionIds(record) {
  return [
    ...(record.blueBans || []),
    ...(record.redBans || []),
    ...(record.bluePicks || []),
    ...(record.redPicks || []),
  ].filter((id) => !isEmptyBanId(id));
}

export function createSeriesEventId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
