import { useMemo } from 'react';
import { useBp } from '../context/BpContext';
import { DRAFT_FLOW, slotId } from '../constants';

function DraftSlot({ team, type, index }) {
  const {
    bpState,
    champions,
    getChampionIconUrl,
    canEditSlots,
    activeSlotId,
    dragOverSlotId,
    draggingSlotId,
    onSlotDragStart,
    onDragEnd,
    onSlotDragOver,
    onSlotDrop,
  } = useBp();

  const isBan = type === 'bans';
  const dataArray = isBan ? bpState.teamData[team].bans : bpState.teamData[team].picks;
  const champId = dataArray[index - 1];
  const id = slotId(team, type, index);
  const isActive = activeSlotId === id;
  const isDragOver = dragOverSlotId === id;
  const isDragging = draggingSlotId === id;

  const champ = champions.find((c) => c.id === champId);
  const name = champ?.name || champId;

  const classNames = [
    'slot',
    isBan ? 'slot-ban' : 'slot-pick',
    champId ? 'slot-filled' : '',
    champId && isBan ? 'slot-ban-done' : '',
    champId && !isBan ? `slot-pick-${team.toLowerCase()}` : '',
    isActive ? 'slot-active' : '',
    isDragOver ? 'slot-drag-over' : '',
    isDragging ? 'dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      id={id}
      className={classNames}
      draggable={!!champId && canEditSlots()}
      onDragStart={(e) => champId && onSlotDragStart(e, id, champId)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onSlotDragOver(e, id)}
      onDrop={(e) => onSlotDrop(e, id)}
    >
      {champId ? (
        <>
          <img
            src={getChampionIconUrl(champId)}
            alt={name}
            className="w-full h-full object-cover pointer-events-none"
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/72x72/333/fff?text=?';
            }}
          />
          {isBan && <div className="ban-x">×</div>}
        </>
      ) : (
        !isBan && <span className="slot-num">{index}</span>
      )}
    </div>
  );
}

function BanGroup({ team }) {
  const { bpState } = useBp();
  const count = bpState.banCounts[team];
  const isBlue = team === 'Blue';

  return (
    <div className={`ban-group ${isBlue ? 'ban-group-blue' : 'ban-group-red'}`}>
      <span className="ban-label">Ban {count}/5</span>
      <div className="ban-slots">
        {[1, 2, 3, 4, 5].map((i) => (
          <DraftSlot key={i} team={team} type="bans" index={i} />
        ))}
      </div>
    </div>
  );
}

function SeriesBannedGroup() {
  const { seriesPickedChampions, champions, getChampionIconUrl } = useBp();

  const bannedChampions = useMemo(() => {
    const idSet = new Set(seriesPickedChampions);
    return champions
      .filter((c) => idSet.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }, [seriesPickedChampions, champions]);

  if (!bannedChampions.length) return null;

  return (
    <div className="series-banned-group">
      <span className="ban-label series-banned-label">
        系列禁用 {bannedChampions.length}
      </span>
      <div className="series-banned-slots custom-scroll">
        {bannedChampions.map((c) => (
            <div key={c.id} className="series-banned-chip" title={c.name}>
              <img
                src={getChampionIconUrl(c.id)}
                alt={c.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/45x45/333/fff?text=?';
                }}
              />
            </div>
          ))}
      </div>
    </div>
  );
}

function PickColumn({ team }) {
  const { bpState, getTeamName } = useBp();
  const count = bpState.pickCounts[team];
  const isBlue = team === 'Blue';

  return (
    <div className={`pick-column ${isBlue ? 'pick-column-blue' : 'pick-column-red'}`}>
      <span className={`side-label ${isBlue ? 'text-blue-400' : 'text-red-400'}`}>
        {getTeamName(team)}
      </span>
      <span className="ban-label">Pick {count}/5</span>
      <div className="pick-slots">
        {[1, 2, 3, 4, 5].map((i) => (
          <DraftSlot key={i} team={team} type="picks" index={i} />
        ))}
      </div>
    </div>
  );
}

export default function DraftArena() {
  return (
    <section className="panel draft-arena mb-6">
      <div className="ban-bar">
        <SeriesBannedGroup />
        <div className="ban-bar-teams">
          <BanGroup team="Blue" />
          <BanGroup team="Red" />
        </div>
      </div>
      <div className="draft-main">
        <PickColumn team="Blue" />
        <ChampionGrid />
        <PickColumn team="Red" />
      </div>
    </section>
  );
}

function ChampionGrid() {
  const {
    championLoadStatus,
    championLoadErrorMessage,
    filteredChampions,
    unavailableIds,
    seriesPickedChampions,
    bpState,
    search,
    setSearch,
    handleSelection,
    onChampDragStart,
    onDragEnd,
    draggingChampId,
    getChampionIconUrl,
    loadChampionRoster,
  } = useBp();

  const canSelect =
    championLoadStatus === 'success' &&
    bpState.currentStep > 0 &&
    bpState.currentStep <= DRAFT_FLOW.length;

  const statusText =
    championLoadStatus === 'loading'
      ? '英雄資料載入中…'
      : championLoadStatus === 'error'
        ? '載入失敗，請重試'
        : '';

  return (
    <div className="champion-area">
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋英雄…"
          className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:border-yellow-500"
        />
        {statusText && (
          <span className="text-xs text-gray-500 self-center whitespace-nowrap">{statusText}</span>
        )}
      </div>
      <div className="champion-grid custom-scroll p-1">
        {championLoadStatus === 'loading' && (
          <p className="col-span-full text-center text-gray-500 py-8 text-sm">載入中…</p>
        )}
        {championLoadStatus === 'error' && (
          <div className="col-span-full text-center py-8 space-y-3">
            <p className="text-red-400 text-sm">載入失敗：{championLoadErrorMessage}</p>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-yellow-500 text-gray-900 text-sm font-semibold"
              onClick={loadChampionRoster}
            >
              重試
            </button>
          </div>
        )}
        {championLoadStatus === 'success' &&
          filteredChampions.map((c) => {
            const isUnavailable = unavailableIds.has(c.id);
            const isSeriesBanned = seriesPickedChampions.includes(c.id);
            const disabled = isUnavailable || !canSelect;
            const isDragging = draggingChampId === c.id;

            return (
              <button
                key={c.id}
                type="button"
                className={[
                  'champ-card relative overflow-hidden p-1',
                  disabled ? 'disabled' : 'draggable-champ',
                  isSeriesBanned ? 'series-banned' : '',
                  isDragging ? 'dragging' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={!disabled}
                onDragStart={(e) => !disabled && onChampDragStart(e, c.id)}
                onDragEnd={onDragEnd}
                onClick={() => !disabled && handleSelection(c.id)}
              >
                <img
                  src={getChampionIconUrl(c.id)}
                  alt={c.name}
                  className="w-full aspect-square object-cover rounded"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/64x64/333/fff?text=?';
                  }}
                />
                <p className="text-[10px] text-center mt-1 truncate px-0.5">{c.name}</p>
                {isSeriesBanned && <span className="series-tag">系列禁用</span>}
              </button>
            );
          })}
      </div>
    </div>
  );
}
