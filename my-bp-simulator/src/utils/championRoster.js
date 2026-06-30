import { DEFAULT_DDRAGON_VERSION } from '../constants';

export async function fetchChampionRoster() {
  const versionsRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', { cache: 'no-store' });
  if (!versionsRes.ok) throw new Error(`版本載入失敗 (${versionsRes.status})`);
  const versions = await versionsRes.json();
  const version = versions?.length ? versions[0] : DEFAULT_DDRAGON_VERSION;

  const champsRes = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_TW/champion.json`,
    { cache: 'no-store' },
  );
  if (!champsRes.ok) throw new Error(`英雄載入失敗 (${champsRes.status})`);

  const json = await champsRes.json();
  const entries = Object.values(json.data || {});
  if (!entries.length) throw new Error('未取得英雄資料');

  const champions = entries
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  return { version, champions };
}

export function getChampionIconUrl(version, id) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`;
}
