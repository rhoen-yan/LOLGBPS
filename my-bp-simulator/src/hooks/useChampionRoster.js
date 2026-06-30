import { useCallback, useEffect, useState } from 'react';
import { fetchChampionRoster, getChampionIconUrl as buildIconUrl } from '../utils/championRoster';

export function useChampionRoster() {
  const [ddragonVersion, setDdragonVersion] = useState('');
  const [champions, setChampions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMessage('');
    try {
      const { version, champions: list } = await fetchChampionRoster();
      setDdragonVersion(version);
      setChampions(list);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || '未知錯誤');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getChampionIconUrl = useCallback(
    (id) => (ddragonVersion ? buildIconUrl(ddragonVersion, id) : ''),
    [ddragonVersion],
  );

  return { champions, status, errorMessage, load, getChampionIconUrl };
}
