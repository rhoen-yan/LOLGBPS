import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyBpState,
  DEFAULT_DDRAGON_VERSION,
  DRAFT_FLOW,
  EDIT_PASSWORD,
  EMPTY_BAN_CHAMPION,
  formatSeriesLabel,
  getTeamArray,
  getWinsToWin,
  isEmptyBanId,
  normalizeSeriesLength,
  normalizeSeriesMode,
} from '../constants';
import { fetchChampionRoster } from '../utils/championRoster';
import { createSeriesEventId } from '../utils/championMention';
import { emptyPickLanes } from '../utils/pickLanes';
import {
  fetchRemoteRecordMeta,
  getLastSavedUpdatedAt,
  isSavePending,
  loadPersistedRecord,
  readEditUnlocked,
  schedulePersistRecord,
  writeEditUnlocked,
} from '../utils/recordApi';
import {
  buildArchivedSeriesSnapshot,
  buildSeriesRecordPayload,
  computeTeamSeriesScore,
  formatDateYmd,
  getSeriesMatchupNames,
} from '../utils/seriesStorage';

function parseSlotFromId(slotId) {
  const [teamRaw, type, indexRaw] = slotId.split('-');
  return {
    team: teamRaw.charAt(0).toUpperCase() + teamRaw.slice(1),
    type,
    index: parseInt(indexRaw, 10),
  };
}

function syncOurTeamName(teamNames, ourSide, myTeamName) {
  const trimmed = myTeamName.trim();
  if (!trimmed || !ourSide) return teamNames;

  const blueDefault = '藍方';
  const redDefault = '紅方';
  const other = ourSide === 'Blue' ? 'Red' : 'Blue';
  const updated = { ...teamNames };

  updated[ourSide] = trimmed;
  if (updated[other] === trimmed) {
    updated[other] = other === 'Blue' ? blueDefault : redDefault;
  }

  return updated;
}

function clearMyTeamNameFromSides(teamNames, myTeamName) {
  const trimmed = myTeamName.trim();
  if (!trimmed) return teamNames;

  const updated = { ...teamNames };
  if (updated.Blue === trimmed) updated.Blue = '藍方';
  if (updated.Red === trimmed) updated.Red = '紅方';
  return updated;
}

export function useBpSimulator() {
  const [ddragonVersion, setDdragonVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [champions, setChampions] = useState([]);
  const [championLoadStatus, setChampionLoadStatus] = useState('idle');
  const [championLoadErrorMessage, setChampionLoadErrorMessage] = useState('');

  const [teamNames, setTeamNames] = useState({ Blue: '藍方', Red: '紅方' });
  const [myTeamName, setMyTeamName] = useState('');
  const [archivedSeries, setArchivedSeries] = useState([]);
  const [seriesStartDate, setSeriesStartDate] = useState(null);
  const [ourSide, setOurSide] = useState(null);
  const [currentSeriesScore, setCurrentSeriesScore] = useState({ Blue: 0, Red: 0 });
  const [currentGameNumber, setCurrentGameNumber] = useState(1);
  const [seriesMode, setSeriesMode] = useState('bo');
  const [seriesLength, setSeriesLength] = useState(5);
  const [seriesHistory, setSeriesHistory] = useState([]);
  const [seriesPickedChampions, setSeriesPickedChampions] = useState([]);
  const [recordHydrated, setRecordHydrated] = useState(false);
  const [canEdit, setCanEdit] = useState(() => readEditUnlocked());
  const [bpState, setBpState] = useState(createEmptyBpState);
  const [search, setSearch] = useState('');
  const [teamInputsLocked, setTeamInputsLocked] = useState(false);
  const [dragOverSlotId, setDragOverSlotId] = useState(null);
  const [draggingSlotId, setDraggingSlotId] = useState(null);
  const [draggingChampId, setDraggingChampId] = useState(null);

  const [modal, setModal] = useState({
    open: false,
    title: '',
    text: '',
    mode: 'alert',
    onConfirm: null,
    confirmLabel: '確認重置',
  });
  const [teamsBarFlash, setTeamsBarFlash] = useState(false);

  const dragPayloadRef = useRef(null);
  const modalDismissRef = useRef(null);
  const lastAppliedRemoteAtRef = useRef(null);

  const tryUnlockEdit = useCallback((password) => {
    if (password !== EDIT_PASSWORD) return false;
    setCanEdit(true);
    writeEditUnlocked(true);
    return true;
  }, []);

  const lockEdit = useCallback(() => {
    setCanEdit(false);
    writeEditUnlocked(false);
  }, []);

  const applyRecordSnapshot = useCallback((saved) => {
    if (!saved) return;
    setArchivedSeries(saved.archivedSeries ?? []);
    if (saved.teamNames) setTeamNames(saved.teamNames);
    if (saved.settings?.myTeamName !== undefined) setMyTeamName(saved.settings.myTeamName);
    const savedCurrent = saved.current;
    if (!savedCurrent) return;
    setSeriesStartDate(savedCurrent.startDate ?? null);
    setOurSide(savedCurrent.ourSide ?? null);
    setCurrentSeriesScore(savedCurrent.currentSeriesScore ?? { Blue: 0, Red: 0 });
    setCurrentGameNumber(savedCurrent.currentGameNumber ?? 1);
    setSeriesMode(normalizeSeriesMode(savedCurrent.seriesMode));
    setSeriesLength(normalizeSeriesLength(savedCurrent.seriesLength, savedCurrent.seriesMode));
    setSeriesHistory(savedCurrent.seriesHistory ?? []);
    setSeriesPickedChampions(savedCurrent.seriesPickedChampions ?? []);
    if (savedCurrent.bpState) setBpState(savedCurrent.bpState);
    setTeamInputsLocked(Boolean(savedCurrent.teamInputsLocked));
  }, []);

  const getChampionIconUrl = useCallback(
    (id) =>
      isEmptyBanId(id)
        ? EMPTY_BAN_CHAMPION.icon
        : `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${id}.png`,
    [ddragonVersion],
  );

  const getTeamName = useCallback(
    (side) => teamNames[side] || (side === 'Blue' ? '藍方' : '紅方'),
    [teamNames],
  );

  const showModal = useCallback((title, text, onDismiss) => {
    modalDismissRef.current = onDismiss ?? null;
    setModal({ open: true, title, text, mode: 'alert', onConfirm: null, confirmLabel: '確認重置' });
  }, []);

  const showConfirmModal = useCallback((title, text, onConfirm, confirmLabel = '確認重置') => {
    modalDismissRef.current = null;
    setModal({ open: true, title, text, mode: 'confirm', onConfirm, confirmLabel });
  }, []);

  const hideModal = useCallback(() => {
    const onDismiss = modalDismissRef.current;
    modalDismissRef.current = null;
    setModal({ open: false, title: '', text: '', mode: 'alert', onConfirm: null, confirmLabel: '確認重置' });
    onDismiss?.();
  }, []);

  const confirmModal = useCallback(() => {
    const handler = modal.onConfirm;
    modalDismissRef.current = null;
    setModal({ open: false, title: '', text: '', mode: 'alert', onConfirm: null, confirmLabel: '確認重置' });
    if (handler) handler();
  }, [modal.onConfirm]);

  const saveTeamName = useCallback(
    (side, value) => {
      if (!canEdit) return;
      const trimmed = value.trim() || (side === 'Blue' ? '藍方' : '紅方');
      const configured = myTeamName.trim();
      const sideDefault = side === 'Blue' ? '藍方' : '紅方';

      if (configured && trimmed === configured) {
        setOurSide(side);
        setTeamNames((names) => syncOurTeamName(names, side, configured));
        return;
      }

      if (ourSide === side && trimmed === sideDefault) {
        setOurSide(null);
        setTeamNames((prev) => ({ ...prev, [side]: trimmed }));
        return;
      }

      setTeamNames((prev) => ({ ...prev, [side]: trimmed }));
    },
    [canEdit, myTeamName, ourSide],
  );

  const updateTeamNameInput = useCallback((side, value) => {
    setTeamNames((prev) => ({ ...prev, [side]: value }));
  }, []);

  const updateMyTeamNameInput = useCallback((value) => {
    setMyTeamName(value);
  }, []);

  const saveMyTeamName = useCallback(
    (value) => {
      if (!canEdit) return;
      const trimmed = value.trim();
      setMyTeamName(trimmed);
      if (ourSide && trimmed) {
        setTeamNames((names) => syncOurTeamName(names, ourSide, trimmed));
      }
    },
    [canEdit, ourSide],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { record: saved, updatedAt } = await loadPersistedRecord();
      if (cancelled) return;
      if (saved) applyRecordSnapshot(saved);
      if (updatedAt) lastAppliedRemoteAtRef.current = updatedAt;
      setRecordHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyRecordSnapshot]);

  useEffect(() => {
    if (!recordHydrated) return;
    const payload = buildSeriesRecordPayload({
      archivedSeries,
      teamNames,
      settings: { myTeamName },
      current: {
        startDate: seriesStartDate,
        ourSide,
        seriesMode,
        seriesLength,
        currentSeriesScore,
        currentGameNumber,
        seriesHistory,
        seriesPickedChampions,
        bpState,
        teamInputsLocked,
      },
    });
    if (!canEdit) return;
    schedulePersistRecord(payload, (updatedAt) => {
      if (updatedAt) lastAppliedRemoteAtRef.current = updatedAt;
    });
  }, [
    recordHydrated,
    canEdit,
    archivedSeries,
    teamNames,
    myTeamName,
    seriesStartDate,
    ourSide,
    seriesHistory,
    currentSeriesScore,
    currentGameNumber,
    seriesMode,
    seriesLength,
    seriesPickedChampions,
    bpState,
    teamInputsLocked,
  ]);

  const bpStateRef = useRef(bpState);
  bpStateRef.current = bpState;

  useEffect(() => {
    if (!recordHydrated) return;
    const poll = async () => {
      if (isSavePending()) return;
      try {
        const { record, updatedAt } = await fetchRemoteRecordMeta();
        if (isSavePending()) return;
        if (!record || !updatedAt) return;
        if (updatedAt === lastAppliedRemoteAtRef.current) return;
        if (canEdit && updatedAt === getLastSavedUpdatedAt()) {
          lastAppliedRemoteAtRef.current = updatedAt;
          return;
        }
        const localStep = bpStateRef.current.currentStep;
        const remoteStep = record.current?.bpState?.currentStep ?? 0;
        if (canEdit && localStep > 0 && localStep > remoteStep) return;
        applyRecordSnapshot(record);
        lastAppliedRemoteAtRef.current = updatedAt;
      } catch {
        /* polling fallback */
      }
    };
    poll();
    const id = window.setInterval(poll, 2000);
    return () => window.clearInterval(id);
  }, [recordHydrated, canEdit, applyRecordSnapshot]);

  useEffect(() => {
    if (!teamsBarFlash) return;
    const id = window.setTimeout(() => setTeamsBarFlash(false), 1400);
    return () => window.clearTimeout(id);
  }, [teamsBarFlash]);

  const loadChampionRoster = useCallback(async () => {
    setChampionLoadStatus('loading');
    setChampionLoadErrorMessage('');
    try {
      const { version, champions: list } = await fetchChampionRoster();
      setDdragonVersion(version);
      setChampions(list);
      setChampionLoadStatus('success');
    } catch (err) {
      console.error(err);
      setChampionLoadStatus('error');
      setChampionLoadErrorMessage(err.message || '未知錯誤');
    }
  }, []);

  useEffect(() => {
    loadChampionRoster();
  }, [loadChampionRoster]);

  const winsToWin = getWinsToWin(seriesLength);
  const currentSeriesStub = useMemo(
    () => ({ teamNames, games: seriesHistory }),
    [teamNames, seriesHistory],
  );
  const teamSeriesScore = useMemo(
    () => computeTeamSeriesScore(currentSeriesStub),
    [currentSeriesStub],
  );
  const seriesStarted = useMemo(
    () => bpState.currentStep > 0 || seriesHistory.length > 0,
    [bpState.currentStep, seriesHistory.length],
  );
  const seriesEnded =
    seriesMode === 'games'
      ? seriesHistory.filter((game) => game.winner).length >= seriesLength
      : teamSeriesScore.scoreA >= winsToWin || teamSeriesScore.scoreB >= winsToWin;

  const canEditSlots = useCallback(() => {
    if (!canEdit) return false;
    if (seriesEnded) return false;
    return bpState.currentStep > 0;
  }, [canEdit, seriesEnded, bpState.currentStep]);

  const isActiveSlot = useCallback(
    (team, type, index) => {
      const { currentStep, banCounts, pickCounts } = bpState;
      if (currentStep < 1 || currentStep > DRAFT_FLOW.length) return false;
      const action = DRAFT_FLOW[currentStep - 1];
      const expectedType = action.type === 'Ban' ? 'bans' : 'picks';
      const count = type === 'bans' ? banCounts[team] : pickCounts[team];
      return action.team === team && expectedType === type && index === count + 1;
    },
    [bpState],
  );

  const canDropOnSlot = useCallback(
    (team, type, index) => {
      if (!canEdit) return false;
      if (!canEditSlots()) return false;
      const arr = getTeamArray(bpState.teamData, team, type);

      if (bpState.currentStep > DRAFT_FLOW.length) {
        if (type !== 'picks') return false;
        return index <= arr.length;
      }

      if (index <= arr.length) return true;
      return isActiveSlot(team, type, index);
    },
    [canEdit, canEditSlots, bpState, isActiveSlot],
  );

  const isChampionUsedElsewhere = useCallback(
    (championId, exceptSlot = null) => {
      if (isEmptyBanId(championId)) return false;
      for (const side of ['Blue', 'Red']) {
        for (const kind of ['bans', 'picks']) {
          const arr = getTeamArray(bpState.teamData, side, kind);
          for (let i = 0; i < arr.length; i++) {
            const slotIndex = i + 1;
            if (
              arr[i] === championId &&
              (!exceptSlot ||
                exceptSlot.team !== side ||
                exceptSlot.type !== kind ||
                exceptSlot.index !== slotIndex)
            ) {
              return true;
            }
          }
        }
      }
      return false;
    },
    [bpState.teamData],
  );

  const validateChampionForAssignment = useCallback(
    (championId, exceptSlot = null, targetType = null) => {
      if (isEmptyBanId(championId)) {
        return targetType === 'bans';
      }
      if (seriesPickedChampions.includes(championId)) {
        const name = champions.find((c) => c.id === championId)?.name || championId;
        showModal('系列賽禁用', `${name} 已在先前局數被 Pick，本系列賽不可再選。`);
        return false;
      }
      if (isChampionUsedElsewhere(championId, exceptSlot)) return false;
      return true;
    },
    [seriesPickedChampions, champions, showModal, isChampionUsedElsewhere],
  );

  const handleSelection = useCallback(
    (championId) => {
      if (!canEdit) return;
      if (championLoadStatus !== 'success') return;
      if (bpState.currentStep === 0 || bpState.currentStep > DRAFT_FLOW.length) {
        showModal('提示', '請先點擊「開始選角」。');
        return;
      }
      if (seriesPickedChampions.includes(championId)) {
        const name = champions.find((c) => c.id === championId)?.name || championId;
        showModal('系列賽禁用', `${name} 已在先前局數被 Pick，本系列賽不可再選。`);
        return;
      }
      if (bpState.selectedChampions.includes(championId)) return;

      const action = DRAFT_FLOW[bpState.currentStep - 1];
      if (isEmptyBanId(championId) && action.type !== 'Ban') return;
      setBpState((prev) => {
        const next = structuredClone(prev);
        if (action.type === 'Ban') {
          next.teamData[action.team].bans.push(championId);
          next.banCounts[action.team]++;
        } else {
          next.selectedChampions = [...next.selectedChampions, championId];
          next.teamData[action.team].picks.push(championId);
          next.pickCounts[action.team]++;
        }
        if (action.type === 'Ban' && !isEmptyBanId(championId)) {
          next.selectedChampions = [...next.selectedChampions, championId];
        }
        next.currentStep++;
        return next;
      });
    },
    [canEdit, championLoadStatus, bpState, seriesPickedChampions, champions, showModal],
  );

  const assignChampionToSlot = useCallback(
    (team, type, index, championId) => {
      const arr = getTeamArray(bpState.teamData, team, type);
      const count = arr.length;
      const isReplace = index <= count;
      const exceptSlot = isReplace ? { team, type, index } : null;

      if (!validateChampionForAssignment(championId, exceptSlot, type)) return;

      if (isReplace) {
        const oldId = arr[index - 1];
        if (oldId === championId) return;
        setBpState((prev) => {
          const next = structuredClone(prev);
          const list = getTeamArray(next.teamData, team, type);
          list[index - 1] = championId;
          next.selectedChampions = next.selectedChampions.filter((id) => id !== oldId);
          if (!isEmptyBanId(championId)) next.selectedChampions.push(championId);
          return next;
        });
      } else if (isActiveSlot(team, type, index) && index === count + 1) {
        handleSelection(championId);
      }
    },
    [bpState.teamData, validateChampionForAssignment, isActiveSlot, handleSelection],
  );

  const swapSlotChampions = useCallback((source, target) => {
    setBpState((prev) => {
      const sourceArr = getTeamArray(prev.teamData, source.team, source.type);
      const targetArr = getTeamArray(prev.teamData, target.team, target.type);
      if (source.index > sourceArr.length || target.index > targetArr.length) return prev;

      const sourceId = sourceArr[source.index - 1];
      const targetId = targetArr[target.index - 1];
      if (!sourceId || !targetId || sourceId === targetId) return prev;
      if (isEmptyBanId(sourceId) && target.type !== 'bans') return prev;
      if (isEmptyBanId(targetId) && source.type !== 'bans') return prev;

      const next = structuredClone(prev);
      getTeamArray(next.teamData, source.team, source.type)[source.index - 1] = targetId;
      getTeamArray(next.teamData, target.team, target.type)[target.index - 1] = sourceId;
      return next;
    });
  }, []);

  const handleSlotDrop = useCallback(
    (target, payload) => {
      const { team, type, index } = target;
      if (!canDropOnSlot(team, type, index)) return;

      if (payload.source === 'grid') {
        assignChampionToSlot(team, type, index, payload.championId);
        return;
      }

      if (payload.source === 'slot') {
        if (payload.team === team && payload.type === type && payload.index === index) return;
        const targetArr = getTeamArray(bpState.teamData, team, type);
        if (index <= targetArr.length) {
          swapSlotChampions(payload, target);
        }
      }
    },
    [canDropOnSlot, assignChampionToSlot, bpState.teamData, swapSlotChampions],
  );

  const resetGame = useCallback(() => {
    setBpState(createEmptyBpState());
    setSearch('');
    setTeamInputsLocked(false);
  }, []);

  const updateSeriesFormat = useCallback(
    (nextMode, nextLength) => {
      if (!canEdit || seriesStarted) return;
      const normalizedMode = normalizeSeriesMode(nextMode);
      setSeriesMode(normalizedMode);
      setSeriesLength(normalizeSeriesLength(nextLength, normalizedMode));
    },
    [canEdit, seriesStarted],
  );

  const syncPendingGameRecord = useCallback(() => {
    if (!canEdit) return;
    if (bpState.currentStep <= DRAFT_FLOW.length) return;

    setSeriesHistory((prev) => {
      const existing = prev.find((g) => g.game === currentGameNumber);
      if (existing?.winner) return prev;

      const snapshot = {
        game: currentGameNumber,
        winner: null,
        ourSide,
        blueTeamName: getTeamName('Blue'),
        redTeamName: getTeamName('Red'),
        blueBans: [...bpState.teamData.Blue.bans],
        redBans: [...bpState.teamData.Red.bans],
        bluePicks: [...bpState.teamData.Blue.picks],
        redPicks: [...bpState.teamData.Red.picks],
        bluePickLanes: existing?.bluePickLanes ?? emptyPickLanes(),
        redPickLanes: existing?.redPickLanes ?? emptyPickLanes(),
        note: existing?.note ?? '',
        events: existing?.events ?? [],
      };

      if (existing) {
        return prev.map((g) => (g.game === currentGameNumber ? snapshot : g));
      }
      return [...prev, snapshot];
    });
  }, [canEdit, bpState, currentGameNumber, ourSide, getTeamName]);

  useEffect(() => {
    syncPendingGameRecord();
  }, [syncPendingGameRecord]);

  const resetCurrentGame = useCallback(() => {
    if (!canEdit) return;
    if (bpState.currentStep === 0) {
      showModal('提示', '本局尚未開始。');
      return;
    }
    if (seriesEnded) {
      showModal('提示', '系列賽已結束。');
      return;
    }
    showConfirmModal(
      '確認重置本局',
      `確定要重置第 ${currentGameNumber} 局 B/P？系列賽比分不會變動。`,
      () => {
        setSeriesHistory((prev) =>
          prev.filter((g) => !(g.game === currentGameNumber && !g.winner)),
        );
        resetGame();
      },
    );
  }, [canEdit, bpState.currentStep, seriesEnded, showModal, showConfirmModal, currentGameNumber, resetGame]);

  const archiveCurrentSeries = useCallback(() => {
    const snapshot = buildArchivedSeriesSnapshot({
      startDate: seriesStartDate,
      seriesMode,
      seriesLength,
      teamNames,
      currentSeriesScore,
      seriesHistory,
    });
    if (snapshot) {
      setArchivedSeries((prev) => [...prev, snapshot]);
    }
  }, [seriesStartDate, seriesMode, seriesLength, teamNames, currentSeriesScore, seriesHistory]);

  const clearCurrentSeries = useCallback(() => {
    setSeriesStartDate(null);
    setOurSide(null);
    setTeamNames((names) => clearMyTeamNameFromSides(names, myTeamName));
    setCurrentSeriesScore({ Blue: 0, Red: 0 });
    setCurrentGameNumber(1);
    setSeriesHistory([]);
    setSeriesPickedChampions([]);
    resetGame();
    setTeamInputsLocked(false);
  }, [resetGame, myTeamName]);

  const requestRemoveSeries = useCallback(
    (series) => {
      if (!canEdit) return;
      const [teamA, teamB] = getSeriesMatchupNames(series);
      showConfirmModal(
        '確認移除系列賽',
        `確定要移除 ${formatSeriesLabel(series.seriesLength, series.seriesMode)} ${teamA} vs ${teamB}？此操作無法復原。`,
        () => {
          if (series.id === 'current') {
            clearCurrentSeries();
          } else {
            setArchivedSeries((prev) => prev.filter((s) => s.id !== series.id));
          }
        },
        '移除',
      );
    },
    [canEdit, showConfirmModal, clearCurrentSeries],
  );

  const resetSeries = useCallback(() => {
    if (!canEdit) return;
    archiveCurrentSeries();
    setSeriesStartDate(null);
    setOurSide(null);
    setTeamNames((names) => clearMyTeamNameFromSides(names, myTeamName));
    setCurrentSeriesScore({ Blue: 0, Red: 0 });
    setCurrentGameNumber(1);
    setSeriesHistory([]);
    setSeriesPickedChampions([]);
    resetGame();
    showModal('已重置', `${formatSeriesLabel(seriesLength, seriesMode)} 系列賽已重置，Pick 禁用清單已清除。`);
  }, [canEdit, archiveCurrentSeries, resetGame, showModal, seriesMode, seriesLength, myTeamName]);

  const toggleOurSide = useCallback(
    (side) => {
      if (!canEdit) return;
      const trimmed = myTeamName.trim();
      setOurSide((prev) => {
        const next = prev === side ? null : side;

        if (trimmed) {
          setTeamNames((names) => {
            if (next) return syncOurTeamName(names, next, trimmed);
            if (prev) {
              const updated = { ...names };
              const def = prev === 'Blue' ? '藍方' : '紅方';
              if (updated[prev] === trimmed) updated[prev] = def;
              return updated;
            }
            return names;
          });
        }

        return next;
      });
    },
    [canEdit, myTeamName],
  );

  const startDraft = useCallback(() => {
    if (!canEdit) return;
    if (bpState.currentStep > 0) return;
    if (championLoadStatus !== 'success') {
      showModal('請稍候', '英雄資料尚未載入完成。');
      return;
    }
    if (seriesEnded) {
      showModal('系列賽已結束', '請先重置系列賽。');
      return;
    }
    setSeriesStartDate((prev) => prev || formatDateYmd());
    setBpState((prev) => ({ ...prev, currentStep: 1 }));
    setTeamInputsLocked(true);
  }, [canEdit, bpState.currentStep, championLoadStatus, seriesEnded, showModal]);

  const declareWinner = useCallback(
    (winningTeam) => {
      if (!canEdit) return;
      if (bpState.currentStep <= DRAFT_FLOW.length) {
        showModal('尚未完成', '請完成全部 20 步 Ban/Pick 後再宣告勝利。');
        return;
      }
      if (!ourSide) {
        showModal('提示', '請先選擇我方位置', () => {
          setTeamsBarFlash(false);
          requestAnimationFrame(() => setTeamsBarFlash(true));
        });
        return;
      }

      setSeriesPickedChampions((prev) => [
        ...new Set([
          ...prev,
          ...bpState.teamData.Blue.picks,
          ...bpState.teamData.Red.picks,
        ]),
      ]);

      setSeriesHistory((prev) => {
        const existing = prev.find((g) => g.game === currentGameNumber);
        const finalized = {
          game: currentGameNumber,
          winner: winningTeam,
          ourSide,
          blueTeamName: getTeamName('Blue'),
          redTeamName: getTeamName('Red'),
          blueBans: [...bpState.teamData.Blue.bans],
          redBans: [...bpState.teamData.Red.bans],
          bluePicks: [...bpState.teamData.Blue.picks],
          redPicks: [...bpState.teamData.Red.picks],
          bluePickLanes: existing?.bluePickLanes ?? emptyPickLanes(),
          redPickLanes: existing?.redPickLanes ?? emptyPickLanes(),
          note: existing?.note ?? '',
          events: existing?.events ?? [],
        };

        const next = existing
          ? prev.map((g) => (g.game === currentGameNumber ? finalized : g))
          : [...prev, finalized];

        const { teamA, teamB, scoreA, scoreB } = computeTeamSeriesScore({
          teamNames,
          games: next,
        });
        const needed = getWinsToWin(seriesLength);
        const gamesPlayed = next.filter((game) => game.winner).length;
        const fixedCountComplete = seriesMode === 'games' && gamesPlayed >= seriesLength;
        const boComplete = seriesMode === 'bo' && (scoreA >= needed || scoreB >= needed);

        if (!fixedCountComplete && !boComplete) {
          setCurrentGameNumber((g) => g + 1);
          resetGame();
        } else {
          const finalWinnerName = scoreA === scoreB ? null : scoreA > scoreB ? teamA : teamB;
          const wScore = finalWinnerName === teamA ? scoreA : scoreB;
          const lScore = finalWinnerName === teamA ? scoreB : scoreA;
          showModal(
            '系列賽結束',
            finalWinnerName
              ? `${finalWinnerName} 以 ${wScore}:${lScore} 贏下系列賽。`
              : `系列賽以 ${scoreA}:${scoreB} 平手結束。`,
          );
        }

        return next;
      });

      setOurSide(null);
      setTeamInputsLocked(false);
    },
    [canEdit, bpState, currentGameNumber, seriesMode, seriesLength, ourSide, teamNames, getTeamName, showModal, resetGame],
  );

  const patchSeriesGame = useCallback((seriesId, gameNumber, patchFn) => {
    if (!canEdit) return;
    if (seriesId === 'current') {
      setSeriesHistory((prev) =>
        prev.map((game) => (game.game === gameNumber ? patchFn(game) : game)),
      );
      return;
    }

    setArchivedSeries((prev) =>
      prev.map((series) =>
        series.id !== seriesId
          ? series
          : {
              ...series,
              games: series.games.map((game) =>
                game.game === gameNumber ? patchFn(game) : game,
              ),
            },
      ),
    );
  }, [canEdit]);

  const updateSeriesDate = useCallback(
    (seriesId, startDate) => {
      if (!canEdit) return;
      const normalized = startDate || formatDateYmd();
      if (seriesId === 'current') {
        setSeriesStartDate(normalized);
        return;
      }
      setArchivedSeries((prev) =>
        prev.map((series) =>
          series.id === seriesId ? { ...series, startDate: normalized } : series,
        ),
      );
    },
    [canEdit],
  );

  const updateSeriesNote = useCallback(
    (seriesId, gameNumber, note) => {
      patchSeriesGame(seriesId, gameNumber, (game) => ({ ...game, note }));
    },
    [patchSeriesGame],
  );

  const updateGamePickLane = useCallback(
    (seriesId, gameNumber, side, pickIndex, laneId) => {
      const laneKey = side === 'Blue' ? 'bluePickLanes' : 'redPickLanes';

      patchSeriesGame(seriesId, gameNumber, (game) => {
        const lanes = [...(game[laneKey] ?? emptyPickLanes())];
        lanes[pickIndex] = lanes[pickIndex] === laneId ? null : laneId;
        return { ...game, [laneKey]: lanes };
      });
    },
    [patchSeriesGame],
  );

  const addSeriesEvent = useCallback(
    (seriesId, gameNumber) => {
      patchSeriesGame(seriesId, gameNumber, (game) => ({
        ...game,
        events: [
          ...(game.events || []),
          { id: createSeriesEventId(), time: '', text: '' },
        ],
      }));
    },
    [patchSeriesGame],
  );

  const updateSeriesEvent = useCallback(
    (seriesId, gameNumber, eventId, patch) => {
      patchSeriesGame(seriesId, gameNumber, (game) => ({
        ...game,
        events: (game.events || []).map((ev) =>
          ev.id === eventId ? { ...ev, ...patch } : ev,
        ),
      }));
    },
    [patchSeriesGame],
  );

  const removeSeriesEvent = useCallback(
    (seriesId, gameNumber, eventId) => {
      patchSeriesGame(seriesId, gameNumber, (game) => ({
        ...game,
        events: (game.events || []).filter((ev) => ev.id !== eventId),
      }));
    },
    [patchSeriesGame],
  );

  const updateGameWinner = useCallback(
    (seriesId, gameNumber, winner) => {
      if (!canEdit) return;
      const normalized = winner === 'Red' ? 'Red' : 'Blue';

      if (seriesId === 'current') {
        setSeriesHistory((prev) => {
          const target = prev.find((g) => g.game === gameNumber);
          if (!target || target.winner === normalized) return prev;

          const next = prev.map((g) =>
            g.game === gameNumber ? { ...g, winner: normalized } : g,
          );
          const { scoreA, scoreB } = computeTeamSeriesScore({ teamNames, games: next });
          const needed = getWinsToWin(seriesLength);
          const ended = scoreA >= needed || scoreB >= needed;

          setCurrentGameNumber(ended ? next.length : next.length + 1);

          return next;
        });
        return;
      }

      setArchivedSeries((prev) =>
        prev.map((series) => {
          if (series.id !== seriesId) return series;
          const target = series.games.find((g) => g.game === gameNumber);
          if (!target || target.winner === normalized) return series;
          const games = series.games.map((g) =>
            g.game === gameNumber ? { ...g, winner: normalized } : g,
          );
          return { ...series, games };
        }),
      );
    },
    [canEdit, seriesLength, teamNames],
  );

  const updateGameOurSide = useCallback(
    (seriesId, gameNumber, ourSide) => {
      if (!canEdit) return;
      const normalized = ourSide === 'Red' ? 'Red' : 'Blue';
      patchSeriesGame(seriesId, gameNumber, (game) => {
        if (game.ourSide === normalized) return game;
        return { ...game, ourSide: normalized };
      });
    },
    [canEdit, patchSeriesGame],
  );

  const renameGameTeamName = useCallback(
    (seriesId, gameNumber, side, newName) => {
      if (!canEdit) return;
      const trimmed = newName.trim();
      if (!trimmed) return;
      const key = side === 'Blue' ? 'blueTeamName' : 'redTeamName';
      patchSeriesGame(seriesId, gameNumber, (game) => {
        if (game[key] === trimmed) return game;
        return { ...game, [key]: trimmed };
      });
    },
    [canEdit, patchSeriesGame],
  );

  const onSlotDragStart = useCallback(
    (e, slotId, championId) => {
      if (!canEditSlots()) {
        e.preventDefault();
        return;
      }
      const parsed = parseSlotFromId(slotId);
      dragPayloadRef.current = { source: 'slot', championId, ...parsed };
      e.dataTransfer.setData('text/plain', championId);
      e.dataTransfer.effectAllowed = 'move';
      setDraggingSlotId(slotId);
    },
    [canEditSlots],
  );

  const onChampDragStart = useCallback((e, championId) => {
    dragPayloadRef.current = { source: 'grid', championId };
    e.dataTransfer.setData('text/plain', championId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingChampId(championId);
  }, []);

  const onDragEnd = useCallback(() => {
    dragPayloadRef.current = null;
    setDraggingSlotId(null);
    setDraggingChampId(null);
    setDragOverSlotId(null);
  }, []);

  const onSlotDragOver = useCallback(
    (e, slotId) => {
      const { team, type, index } = parseSlotFromId(slotId);
      if (!canDropOnSlot(team, type, index)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverSlotId(slotId);
    },
    [canDropOnSlot],
  );

  const onSlotDrop = useCallback(
    (e, slotId) => {
      e.preventDefault();
      setDragOverSlotId(null);
      const championId = e.dataTransfer.getData('text/plain');
      const payload = dragPayloadRef.current || (championId ? { source: 'grid', championId } : null);
      if (!payload) return;
      handleSlotDrop(parseSlotFromId(slotId), payload);
      onDragEnd();
    },
    [handleSlotDrop, onDragEnd],
  );

  const phaseInfo = useMemo(() => {
    if (seriesEnded) {
      const winner =
        teamSeriesScore.scoreA >= winsToWin ? teamSeriesScore.teamA : teamSeriesScore.teamB;
      return { text: `${winner} 系列賽獲勝` };
    }
    if (bpState.currentStep > DRAFT_FLOW.length) {
      return { text: '等待結果' };
    }
    if (bpState.currentStep === 0) {
      return { text: '選角尚未開始' };
    }
    const action = DRAFT_FLOW[bpState.currentStep - 1];
    const teamLabel = getTeamName(action.team);
    const actionLabel = action.type === 'Ban' ? 'Ban' : 'Pick';
    const color = action.team === 'Blue' ? 'text-blue-400' : 'text-red-400';
    return {
      html: true,
      content: `<span class="${color}">${teamLabel} ${action.description}</span> · ${actionLabel}`,
    };
  }, [seriesEnded, teamSeriesScore, winsToWin, bpState.currentStep, getTeamName]);

  const startButtonState = useMemo(() => {
    if (seriesEnded) return { text: '已結束', disabled: true };
    if (championLoadStatus === 'loading') return { text: '載入中…', disabled: true };
    if (championLoadStatus === 'error') return { text: '載入失敗', disabled: true };
    if (bpState.currentStep > DRAFT_FLOW.length) return { text: '完成', disabled: true };
    if (bpState.currentStep > 0) return { text: '進行中…', disabled: true };
    return { text: '開始選角', disabled: false };
  }, [seriesEnded, championLoadStatus, bpState.currentStep]);

  const resetGameButtonDisabled = seriesEnded || bpState.currentStep === 0;
  const showWinnerButtons = bpState.currentStep > DRAFT_FLOW.length && !seriesEnded;
  const canChangeOurSide = !seriesEnded;

  const unavailableIds = useMemo(
    () => new Set([...bpState.selectedChampions, ...seriesPickedChampions]),
    [bpState.selectedChampions, seriesPickedChampions],
  );

  const filteredChampions = useMemo(() => {
    const q = search.toLocaleLowerCase('zh-Hant');
    const currentAction =
      bpState.currentStep > 0 && bpState.currentStep <= DRAFT_FLOW.length
        ? DRAFT_FLOW[bpState.currentStep - 1]
        : null;
    const showEmptyBan = currentAction?.type === 'Ban';
    const filtered = champions.filter((c) => {
      if (!q) return true;
      return c.name.toLocaleLowerCase('zh-Hant').includes(q) || c.id.toLowerCase().includes(q);
    });
    const sorted = [
      ...filtered.filter((c) => !unavailableIds.has(c.id)),
      ...filtered.filter((c) => unavailableIds.has(c.id)),
    ];
    if (!showEmptyBan) return sorted;
    const emptyBanMatches =
      !q ||
      EMPTY_BAN_CHAMPION.name.toLocaleLowerCase('zh-Hant').includes(q) ||
      EMPTY_BAN_CHAMPION.id.toLowerCase().includes(q);
    return emptyBanMatches ? [EMPTY_BAN_CHAMPION, ...sorted] : sorted;
  }, [bpState.currentStep, champions, search, unavailableIds]);

  const activeSlotId = useMemo(() => {
    if (bpState.currentStep <= 0 || bpState.currentStep > DRAFT_FLOW.length) return null;
    const action = DRAFT_FLOW[bpState.currentStep - 1];
    const teamRaw = action.team.toLowerCase();
    const typeRaw = action.type.toLowerCase() + 's';
    const idx =
      action.type === 'Ban'
        ? bpState.banCounts[action.team] + 1
        : bpState.pickCounts[action.team] + 1;
    return `${teamRaw}-${typeRaw}-${idx}`;
  }, [bpState]);

  return {
    champions,
    championLoadStatus,
    championLoadErrorMessage,
    teamNames,
    myTeamName,
    saveMyTeamName,
    updateMyTeamNameInput,
    canEdit,
    tryUnlockEdit,
    lockEdit,
    teamSeriesScore,
    currentGameNumber,
    seriesMode,
    seriesLength,
    seriesStarted,
    updateSeriesFormat,
    winsToWin,
    archivedSeries,
    seriesStartDate,
    ourSide,
    toggleOurSide,
    canChangeOurSide,
    teamsBarFlash,
    seriesHistory,
    seriesPickedChampions,
    bpState,
    search,
    setSearch,
    teamInputsLocked,
    dragOverSlotId,
    draggingSlotId,
    draggingChampId,
    modal,
    getChampionIconUrl,
    getTeamName,
    saveTeamName,
    updateTeamNameInput,
    hideModal,
    confirmModal,
    loadChampionRoster,
    canEditSlots,
    canDropOnSlot,
    handleSelection,
    resetCurrentGame,
    resetSeries,
    startDraft,
    declareWinner,
    updateSeriesNote,
    updateSeriesDate,
    updateGamePickLane,
    addSeriesEvent,
    updateSeriesEvent,
    removeSeriesEvent,
    updateGameWinner,
    updateGameOurSide,
    renameGameTeamName,
    requestRemoveSeries,
    onSlotDragStart,
    onChampDragStart,
    onDragEnd,
    onSlotDragOver,
    onSlotDrop,
    phaseInfo,
    startButtonState,
    resetGameButtonDisabled,
    showWinnerButtons,
    filteredChampions,
    unavailableIds,
    activeSlotId,
  };
}
