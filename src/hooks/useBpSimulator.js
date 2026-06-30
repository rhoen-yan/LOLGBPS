import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyBpState,
  DEFAULT_DDRAGON_VERSION,
  DRAFT_FLOW,
  EDIT_PASSWORD,
  formatSeriesLabel,
  getTeamArray,
  getWinsToWin,
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
  formatDateYmd,
  getSeriesTeamName,
} from '../utils/seriesStorage';

function parseSlotFromId(slotId) {
  const [teamRaw, type, indexRaw] = slotId.split('-');
  return {
    team: teamRaw.charAt(0).toUpperCase() + teamRaw.slice(1),
    type,
    index: parseInt(indexRaw, 10),
  };
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
    setSeriesLength(savedCurrent.seriesLength ?? 5);
    setSeriesHistory(savedCurrent.seriesHistory ?? []);
    setSeriesPickedChampions(savedCurrent.seriesPickedChampions ?? []);
    if (savedCurrent.bpState) setBpState(savedCurrent.bpState);
    setTeamInputsLocked(Boolean(savedCurrent.teamInputsLocked));
  }, []);

  const getChampionIconUrl = useCallback(
    (id) => `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${id}.png`,
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

  const saveTeamName = useCallback((side, value) => {
    if (!canEdit) return;
    const trimmed = value.trim() || (side === 'Blue' ? '藍方' : '紅方');
    setTeamNames((prev) => ({ ...prev, [side]: trimmed }));
  }, [canEdit]);

  const updateTeamNameInput = useCallback((side, value) => {
    setTeamNames((prev) => ({ ...prev, [side]: value }));
  }, []);

  const updateMyTeamNameInput = useCallback((value) => {
    setMyTeamName(value);
  }, []);

  const saveMyTeamName = useCallback((value) => {
    if (!canEdit) return;
    setMyTeamName(value.trim());
  }, [canEdit]);

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
    seriesLength,
    seriesPickedChampions,
    bpState,
    teamInputsLocked,
  ]);

  useEffect(() => {
    if (!recordHydrated) return;
    const poll = async () => {
      if (isSavePending()) return;
      try {
        const { record, updatedAt } = await fetchRemoteRecordMeta();
        if (!record || !updatedAt) return;
        if (updatedAt === lastAppliedRemoteAtRef.current) return;
        if (canEdit && updatedAt === getLastSavedUpdatedAt()) {
          lastAppliedRemoteAtRef.current = updatedAt;
          return;
        }
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
  const seriesStarted = useMemo(
    () =>
      bpState.currentStep > 0 ||
      seriesHistory.length > 0 ||
      currentSeriesScore.Blue > 0 ||
      currentSeriesScore.Red > 0,
    [bpState.currentStep, seriesHistory.length, currentSeriesScore.Blue, currentSeriesScore.Red],
  );
  const seriesEnded = currentSeriesScore.Blue >= winsToWin || currentSeriesScore.Red >= winsToWin;

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
    (championId, exceptSlot = null) => {
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
      setBpState((prev) => {
        const next = structuredClone(prev);
        next.selectedChampions = [...next.selectedChampions, championId];
        if (action.type === 'Ban') {
          next.teamData[action.team].bans.push(championId);
          next.banCounts[action.team]++;
        } else {
          next.teamData[action.team].picks.push(championId);
          next.pickCounts[action.team]++;
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

      if (!validateChampionForAssignment(championId, exceptSlot)) return;

      if (isReplace) {
        const oldId = arr[index - 1];
        if (oldId === championId) return;
        setBpState((prev) => {
          const next = structuredClone(prev);
          const list = getTeamArray(next.teamData, team, type);
          list[index - 1] = championId;
          next.selectedChampions = next.selectedChampions.filter((id) => id !== oldId);
          next.selectedChampions.push(championId);
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
      () => resetGame(),
    );
  }, [canEdit, bpState.currentStep, seriesEnded, showModal, showConfirmModal, currentGameNumber, resetGame]);

  const archiveCurrentSeries = useCallback(() => {
    const snapshot = buildArchivedSeriesSnapshot({
      startDate: seriesStartDate,
      seriesLength,
      teamNames,
      currentSeriesScore,
      seriesHistory,
    });
    if (snapshot) {
      setArchivedSeries((prev) => [...prev, snapshot]);
    }
  }, [seriesStartDate, seriesLength, teamNames, currentSeriesScore, seriesHistory]);

  const clearCurrentSeries = useCallback(() => {
    setSeriesStartDate(null);
    setOurSide(null);
    setCurrentSeriesScore({ Blue: 0, Red: 0 });
    setCurrentGameNumber(1);
    setSeriesHistory([]);
    setSeriesPickedChampions([]);
    resetGame();
    setTeamInputsLocked(false);
  }, [resetGame]);

  const requestRemoveSeries = useCallback(
    (series) => {
      if (!canEdit) return;
      const blueName = getSeriesTeamName(series, 'Blue');
      const redName = getSeriesTeamName(series, 'Red');
      showConfirmModal(
        '確認移除系列賽',
        `確定要移除 ${formatSeriesLabel(series.seriesLength)} ${blueName} vs ${redName}？此操作無法復原。`,
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
    setCurrentSeriesScore({ Blue: 0, Red: 0 });
    setCurrentGameNumber(1);
    setSeriesHistory([]);
    setSeriesPickedChampions([]);
    resetGame();
    showModal('已重置', `${formatSeriesLabel(seriesLength)} 系列賽已重置，Pick 禁用清單已清除。`);
  }, [canEdit, archiveCurrentSeries, resetGame, showModal, seriesLength]);

  const toggleOurSide = useCallback(
    (side) => {
      if (!canEdit) return;
      const trimmed = myTeamName.trim();
      setOurSide((prev) => {
        const next = prev === side ? null : side;

        if (trimmed) {
          setTeamNames((names) => {
            const blueDefault = '藍方';
            const redDefault = '紅方';
            const updated = { ...names };

            const revertSide = (s) => {
              const def = s === 'Blue' ? blueDefault : redDefault;
              if (updated[s] === trimmed) updated[s] = def;
            };

            const applySide = (s) => {
              const def = s === 'Blue' ? blueDefault : redDefault;
              if (updated[s] === def) updated[s] = trimmed;
            };

            if (prev && prev !== next) revertSide(prev);
            if (next === null && prev === side) revertSide(side);
            if (next === side) applySide(side);

            return updated;
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

      setSeriesHistory((prev) => [
        ...prev,
        {
          game: currentGameNumber,
          winner: winningTeam,
          ourSide,
          blueBans: [...bpState.teamData.Blue.bans],
          redBans: [...bpState.teamData.Red.bans],
          bluePicks: [...bpState.teamData.Blue.picks],
          redPicks: [...bpState.teamData.Red.picks],
          bluePickLanes: emptyPickLanes(),
          redPickLanes: emptyPickLanes(),
          note: '',
          events: [],
        },
      ]);

      setOurSide(null);

      setCurrentSeriesScore((prev) => {
        const next = { ...prev, [winningTeam]: prev[winningTeam] + 1 };
        const needed = getWinsToWin(seriesLength);
        if (next.Blue < needed && next.Red < needed) {
          setCurrentGameNumber((g) => g + 1);
          resetGame();
        } else {
          showModal(
            '系列賽結束',
            winningTeam === 'Blue'
              ? `${getTeamName('Blue')} 以 ${next.Blue}:${next.Red} 贏得系列賽`
              : `${getTeamName('Red')} 以 ${next.Red}:${next.Blue} 贏得系列賽`,
          );
        }
        return next;
      });
      setTeamInputsLocked(false);
    },
    [canEdit, bpState, currentGameNumber, seriesLength, ourSide, getTeamName, showModal, resetGame],
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
        lanes[pickIndex] = laneId;
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
      if (currentSeriesScore.Blue >= winsToWin) {
        return { html: true, content: `<span class="text-blue-400">${getTeamName('Blue')} 系列賽獲勝</span>` };
      }
      return { html: true, content: `<span class="text-red-400">${getTeamName('Red')} 系列賽獲勝</span>` };
    }
    if (bpState.currentStep > DRAFT_FLOW.length) {
      return { text: '選角完成，請宣告勝利' };
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
  }, [seriesEnded, currentSeriesScore, winsToWin, bpState.currentStep, getTeamName]);

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
    const filtered = champions.filter((c) => {
      if (!q) return true;
      return c.name.toLocaleLowerCase('zh-Hant').includes(q) || c.id.toLowerCase().includes(q);
    });
    return [
      ...filtered.filter((c) => !unavailableIds.has(c.id)),
      ...filtered.filter((c) => unavailableIds.has(c.id)),
    ];
  }, [champions, search, unavailableIds]);

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
    currentSeriesScore,
    currentGameNumber,
    seriesLength,
    seriesStarted,
    setSeriesLength,
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
    updateGamePickLane,
    addSeriesEvent,
    updateSeriesEvent,
    removeSeriesEvent,
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
