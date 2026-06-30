import { useMemo, useState } from 'react';
import { useBp } from '../context/BpContext';
import ChampionMentionField from './ChampionMentionField';
import ChampionMentionDisplay from './ChampionMentionDisplay';
import GameTimelineEvents from './GameTimelineEvents';
import { formatSeriesLabel } from '../constants';
import { LANES, getLaneById } from '../constants/lanes';
import { collectGameChampionIds, getGameChampionsFromIds } from '../utils/championMention';
import { isGameLaneComplete, seriesHasIncompleteLanes } from '../utils/pickLanes';
import {
  computeBoSeriesStats,
  computeTeamSeriesScore,
  filterSeriesGames,
  getGameTeamName,
  getOurGameResult,
  getOurSeriesResult,
  getSeriesMatchupNames,
  seriesMatchesFilters,
} from '../utils/seriesStorage';

function IncompleteLanesBadge() {
  return <span className="lane-incomplete-badge">尚有路線未標</span>;
}

function EditableTeamName({ name, colorClass, canEdit, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (!canEdit) {
    return <span className={colorClass}>{name}</span>;
  }

  if (editing) {
    return (
      <input
        type="text"
        className={`bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-xs min-w-[4rem] max-w-[8rem] ${colorClass}`}
        value={draft}
        maxLength={20}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`${colorClass} cursor-text`}
      onDoubleClick={() => {
        setDraft(name);
        setEditing(true);
      }}
    >
      {name}
    </span>
  );
}

function ChampBanRow({ ids, champions, getChampionIconUrl }) {
  if (!ids?.length) {
    return <span className="text-xs text-gray-600">—</span>;
  }

  return ids.map((id) => {
    const champ = champions.find((c) => c.id === id);
    const name = champ?.name || id;
    return (
      <div key={id} className="flex flex-col items-center w-12 history-champ-ban">
        <img
          src={getChampionIconUrl(id)}
          alt={name}
          className="w-10 h-10 rounded object-cover border border-gray-700"
          onError={(e) => {
            e.currentTarget.src = 'https://placehold.co/40x40/333/fff?text=?';
          }}
        />
        <span className="text-[10px] text-gray-400 mt-1 truncate w-full text-center">{name}</span>
      </div>
    );
  });
}

function LanePickerRow({ usedLaneIds, currentLaneId, onSelect }) {
  return (
    <div className="lane-picker-row">
      {LANES.map((lane) => {
        const taken = usedLaneIds.includes(lane.id) && lane.id !== currentLaneId;
        return (
          <button
            key={lane.id}
            type="button"
            className={[
              'lane-picker-btn',
              currentLaneId === lane.id ? 'is-active' : '',
              taken ? 'is-taken' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={taken}
            title={lane.label}
            onClick={() => onSelect(lane.id)}
          >
            <img src={lane.icon} alt={lane.label} className="w-full h-full object-contain" />
          </button>
        );
      })}
    </div>
  );
}

function PickLaneCell({
  id,
  index,
  laneId,
  isSelected,
  onSelect,
  champions,
  getChampionIconUrl,
  lanePicker,
}) {
  const champ = champions.find((c) => c.id === id);
  const name = champ?.name || id;
  const lane = laneId ? getLaneById(laneId) : null;

  return (
    <div className="pick-lane-cell">
      <button
        type="button"
        className={['pick-lane-btn', isSelected ? 'is-selected' : '', laneId ? 'has-lane' : '']
          .filter(Boolean)
          .join(' ')}
        onClick={onSelect}
      >
        <img
          src={getChampionIconUrl(id)}
          alt={name}
          className="w-12 h-12 rounded object-cover border border-gray-700"
          onError={(e) => {
            e.currentTarget.src = 'https://placehold.co/48x48/333/fff?text=?';
          }}
        />
        {lane && (
          <span className="pick-lane-assigned">
            <img src={lane.icon} alt={lane.label} className="w-full h-full object-contain" />
          </span>
        )}
      </button>
      <span className="text-[10px] text-gray-400 mt-1 truncate w-14 text-center">{name}</span>
      {isSelected && lanePicker}
    </div>
  );
}

function TeamHistory({
  side,
  bans,
  picks,
  pickLanes,
  teamName,
  seriesId,
  gameNumber,
  canEdit,
  renameGameTeamName,
  champions,
  getChampionIconUrl,
  laneSelection,
  onPickSelect,
  onLaneSelect,
}) {
  const teamColor = side === 'Blue' ? 'text-blue-400' : 'text-red-400';
  const usedLaneIds = (pickLanes ?? []).filter(Boolean);

  return (
    <div>
      <p className="text-xs font-semibold mb-2">
        <EditableTeamName
          name={teamName}
          colorClass={teamColor}
          canEdit={canEdit}
          onSave={(value) => renameGameTeamName(seriesId, gameNumber, side, value)}
        />
      </p>
      <p className="text-[10px] text-gray-500 mb-1">Ban</p>
      <div className="flex flex-wrap gap-2 mb-3">
        <ChampBanRow ids={bans} champions={champions} getChampionIconUrl={getChampionIconUrl} />
      </div>
      <p className="text-[10px] text-gray-500 mb-1">Pick</p>
      <div className="flex flex-wrap gap-2">
        {(picks ?? []).map((id, index) => {
          const isSelected = laneSelection?.side === side && laneSelection?.index === index;
          const otherUsed = usedLaneIds.filter((_, i) => i !== index);
          return (
            <PickLaneCell
              key={`${id}-${index}`}
              id={id}
              index={index}
              laneId={pickLanes?.[index]}
              isSelected={isSelected}
              onSelect={() => onPickSelect(side, index)}
              champions={champions}
              getChampionIconUrl={getChampionIconUrl}
              lanePicker={
                <LanePickerRow
                  usedLaneIds={otherUsed}
                  currentLaneId={pickLanes?.[index]}
                  onSelect={(lane) => onLaneSelect(side, index, lane)}
                />
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function GameRecord({
  record,
  series,
  champions,
  getChampionIconUrl,
  updateSeriesNote,
  updateGamePickLane,
  updateGameWinner,
  updateGameOurSide,
  renameGameTeamName,
  addSeriesEvent,
  updateSeriesEvent,
  removeSeriesEvent,
  canEdit,
}) {
  const [laneSelection, setLaneSelection] = useState(null);
  const winnerCls = record.winner === 'Blue' ? 'winner-blue' : 'winner-red';
  const winnerColor = record.winner === 'Blue' ? 'text-blue-400' : 'text-red-400';
  const blueName = getGameTeamName(record, series, 'Blue');
  const redName = getGameTeamName(record, series, 'Red');
  const winnerName = record.winner === 'Blue' ? blueName : redName;
  const otherWinner = record.winner === 'Blue' ? 'Red' : 'Blue';
  const otherWinnerName = otherWinner === 'Blue' ? blueName : redName;
  const ourResult = getOurGameResult(record, record.ourSide);
  const ourSideName = record.ourSide === 'Blue' ? blueName : record.ourSide === 'Red' ? redName : null;
  const otherOurSide = record.ourSide === 'Blue' ? 'Red' : 'Blue';
  const otherOurSideName = otherOurSide === 'Blue' ? blueName : redName;
  const gameChampions = getGameChampionsFromIds(collectGameChampionIds(record), champions);
  const lanesIncomplete = !isGameLaneComplete(record);
  const isCurrentSeries = Boolean(series.isCurrent);
  const readOnly = !isCurrentSeries || !canEdit;

  const handlePickSelect = (side, index) => {
    if (readOnly) return;
    setLaneSelection((prev) =>
      prev?.side === side && prev?.index === index ? null : { side, index },
    );
  };

  const handleLaneSelect = (side, index, laneId) => {
    if (readOnly) return;
    updateGamePickLane(series.id, record.game, side, index, laneId);
    setLaneSelection(null);
  };

  return (
    <div className={`history-item ${winnerCls} px-4 py-3 bg-gray-800/50 rounded-r-lg`}>
      <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">第 {record.game} 局</span>
          {lanesIncomplete && <IncompleteLanesBadge />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {ourSideName && (
            <span className="text-xs text-gray-500">
              我方
              <span
                className={`ml-1 font-medium ${
                  record.ourSide === 'Blue' ? 'text-blue-400' : 'text-red-400'
                }`}
              >
                {ourSideName}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="ml-1 p-0.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700/60 transition align-middle"
                  title={`改我方為${otherOurSideName}`}
                  aria-label={`改我方為${otherOurSideName}`}
                  onClick={() => updateGameOurSide(series.id, record.game, otherOurSide)}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" />
                  </svg>
                </button>
              )}
            </span>
          )}
          {ourResult && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                ourResult === 'win' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-rose-900/60 text-rose-400'
              }`}
            >
              {ourResult === 'win' ? '勝' : '敗'}
            </span>
          )}
          <span className={`text-sm font-semibold ${winnerColor} mr-[5px]`}>{winnerName} 勝</span>
          {canEdit && (
            <button
              type="button"
              className="p-1 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700/60 transition"
              title={`改為${otherWinnerName}勝`}
              aria-label={`改為${otherWinnerName}勝`}
              onClick={() => updateGameWinner(series.id, record.game, otherWinner)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TeamHistory
          side="Blue"
          bans={record.blueBans}
          picks={record.bluePicks}
          pickLanes={record.bluePickLanes}
          teamName={blueName}
          seriesId={series.id}
          gameNumber={record.game}
          canEdit={canEdit}
          renameGameTeamName={renameGameTeamName}
          champions={champions}
          getChampionIconUrl={getChampionIconUrl}
          laneSelection={laneSelection}
          onPickSelect={handlePickSelect}
          onLaneSelect={handleLaneSelect}
        />
        <TeamHistory
          side="Red"
          bans={record.redBans}
          picks={record.redPicks}
          pickLanes={record.redPickLanes}
          teamName={redName}
          seriesId={series.id}
          gameNumber={record.game}
          canEdit={canEdit}
          renameGameTeamName={renameGameTeamName}
          champions={champions}
          getChampionIconUrl={getChampionIconUrl}
          laneSelection={laneSelection}
          onPickSelect={handlePickSelect}
          onLaneSelect={handleLaneSelect}
        />
      </div>
      <div className="mt-3">
        <p className="text-[10px] text-gray-500 mb-1">備註</p>
        {readOnly ? (
          <ChampionMentionDisplay
            text={record.note}
            champions={champions}
            gameChampions={gameChampions}
            getChampionIconUrl={getChampionIconUrl}
          />
        ) : (
          <ChampionMentionField
            value={record.note || ''}
            onChange={(note) => updateSeriesNote(series.id, record.game, note)}
            placeholder="備註… @ 當局英雄、! 全英雄"
            champions={champions}
            gameChampions={gameChampions}
            getChampionIconUrl={getChampionIconUrl}
          />
        )}
      </div>
      <GameTimelineEvents
        seriesId={series.id}
        gameNumber={record.game}
        events={record.events || []}
        champions={champions}
        gameChampions={gameChampions}
        getChampionIconUrl={getChampionIconUrl}
        addSeriesEvent={addSeriesEvent}
        updateSeriesEvent={updateSeriesEvent}
        removeSeriesEvent={removeSeriesEvent}
        readOnly={readOnly}
      />
    </div>
  );
}

function SeriesRemoveButton({ onClick }) {
  return (
    <button
      type="button"
      className="series-remove-btn"
      title="移除系列賽"
      aria-label="移除系列賽"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    </button>
  );
}

function SeriesGroup({
  series,
  champions,
  getChampionIconUrl,
  updateSeriesNote,
  updateGamePickLane,
  updateGameWinner,
  updateGameOurSide,
  addSeriesEvent,
  updateSeriesEvent,
  removeSeriesEvent,
  requestRemoveSeries,
  renameGameTeamName,
  canEdit,
  filters,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [teamA, teamB] = getSeriesMatchupNames(series);
  const { scoreA, scoreB } = computeTeamSeriesScore(series);
  const seriesResult = getOurSeriesResult(series);
  const seriesLanesIncomplete = seriesHasIncompleteLanes(series);
  const filteredGames = useMemo(
    () => filterSeriesGames(series, filters),
    [series, filters],
  );

  if (!filteredGames.length) return null;

  return (
    <details
      className="history-series-group rounded-lg border border-gray-700/80 bg-gray-900/40"
      open={isOpen}
      onToggle={(e) => setIsOpen(e.currentTarget.open)}
    >
      <summary className="history-series-summary cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-800/50 rounded-lg">
        <span className="history-series-summary-content">
          <span className="mr-2">{formatSeriesLabel(series.seriesLength)}</span>
          <span className="text-gray-300">{teamA}</span>
          <span className="text-gray-500 mx-1.5">vs</span>
          <span className="text-gray-300">{teamB}</span>
          <span className="text-gray-400 mx-2">·</span>
          <span className="tabular-nums text-gray-300">
            {scoreA}:{scoreB}
          </span>
          {seriesResult && (
            <span
              className={`ml-1 text-xs font-medium px-1.5 py-0.5 rounded ${
                seriesResult === 'win'
                  ? 'bg-emerald-900/60 text-emerald-400'
                  : seriesResult === 'loss'
                    ? 'bg-rose-900/60 text-rose-400'
                    : 'bg-gray-700 text-gray-400'
              }`}
            >
              {seriesResult === 'win' ? '系列勝' : seriesResult === 'loss' ? '系列敗' : '平'}
            </span>
          )}
          {series.isCurrent && <span className="ml-2 text-xs text-amber-400">進行中</span>}
          {seriesLanesIncomplete && (
            <span className="ml-2">
              <IncompleteLanesBadge />
            </span>
          )}
        </span>
        {canEdit && <SeriesRemoveButton onClick={() => requestRemoveSeries(series)} />}
      </summary>
      <div className="px-2 pb-3 pt-1 space-y-3">
        {filteredGames.map((r) => (
          <GameRecord
            key={`${series.id}-${r.game}`}
            record={r}
            series={series}
            champions={champions}
            getChampionIconUrl={getChampionIconUrl}
            updateSeriesNote={updateSeriesNote}
            updateGamePickLane={updateGamePickLane}
            updateGameWinner={updateGameWinner}
            updateGameOurSide={updateGameOurSide}
            renameGameTeamName={renameGameTeamName}
            addSeriesEvent={addSeriesEvent}
            updateSeriesEvent={updateSeriesEvent}
            removeSeriesEvent={removeSeriesEvent}
            canEdit={canEdit}
          />
        ))}
      </div>
    </details>
  );
}

export default function SeriesHistoryPanel() {
  const {
    archivedSeries,
    seriesHistory,
    seriesStartDate,
    teamNames,
    seriesLength,
    champions,
    getChampionIconUrl,
    updateSeriesNote,
    updateGamePickLane,
    updateGameWinner,
    updateGameOurSide,
    addSeriesEvent,
    updateSeriesEvent,
    removeSeriesEvent,
    requestRemoveSeries,
    renameGameTeamName,
    canEdit,
  } = useBp();

  const [dateFilter, setDateFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('series');
  const [resultFilter, setResultFilter] = useState('all');

  const filters = useMemo(
    () => ({ dateFilter, teamFilter, scopeFilter, resultFilter }),
    [dateFilter, teamFilter, scopeFilter, resultFilter],
  );

  const allSeries = useMemo(() => {
    const list = [...archivedSeries];
    if (seriesHistory.length > 0) {
      list.push({
        id: 'current',
        startDate: seriesStartDate || '未知',
        seriesLength,
        teamNames: { ...teamNames },
        games: seriesHistory,
        isCurrent: true,
      });
    }
    return list;
  }, [
    archivedSeries,
    seriesHistory,
    seriesStartDate,
    seriesLength,
    teamNames,
  ]);

  const availableDates = useMemo(() => {
    const dates = new Set(allSeries.map((s) => s.startDate).filter(Boolean));
    return [...dates].sort((a, b) => b.localeCompare(a));
  }, [allSeries]);

  const boStats = useMemo(
    () => computeBoSeriesStats(allSeries, { dateFilter, teamFilter }),
    [allSeries, dateFilter, teamFilter],
  );

  const groupedByDate = useMemo(() => {
    const filtered = allSeries.filter((series) => seriesMatchesFilters(series, filters));

    const map = new Map();
    for (const series of filtered) {
      const games = filterSeriesGames(series, filters);
      if (!games.length) continue;
      const date = series.startDate || '未知';
      if (!map.has(date)) map.set(date, []);
      map.get(date).push({ ...series, games });
    }

    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [allSeries, filters]);

  const hasVisible = groupedByDate.length > 0;

  return (
    <section className="panel p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <h3 className="text-base font-bold">系列賽紀錄</h3>
        {boStats.total > 0 && (
          <p className="text-sm tabular-nums text-gray-300">
            <span className="text-emerald-400 font-semibold">W : {boStats.wins}</span>
            <span className="text-gray-500"> / </span>
            <span className="text-rose-400 font-semibold">L : {boStats.losses}</span>
            <span className="ml-2 text-gray-400">{boStats.winRate}%</span>
          </p>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        已 Pick 的英雄在系列賽中不可再選；Ban 不受此限制。備註：@ 當局、! 全英雄。時間軸：@ 目標／當局英雄。
      </p>

      {allSeries.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg bg-gray-800/40 border border-gray-700/60">
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            日期
            <select
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[9rem]"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="">全部</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            隊名
            <input
              type="text"
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[10rem]"
              placeholder="搜尋隊名"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            範圍
            <select
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[7rem]"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
            >
              <option value="series">系列賽</option>
              <option value="game">單局</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400">
            勝敗（我方）
            <select
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[7rem]"
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="win">勝</option>
              <option value="loss">敗</option>
            </select>
          </label>
        </div>
      )}

      <div className="space-y-3">
        {!hasVisible ? (
          <p className="text-sm text-gray-500">{allSeries.length ? '無符合篩選的紀錄' : '尚無紀錄'}</p>
        ) : (
          groupedByDate.map(([date, seriesList]) => (
            <details key={date} className="history-date-group rounded-lg border border-gray-600/80" open>
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-100 bg-gray-800/60 hover:bg-gray-800 rounded-lg">
                {date}
                <span className="ml-2 text-xs font-normal text-gray-500">({seriesList.length} 場系列)</span>
              </summary>
              <div className="p-3 space-y-3">
                {seriesList.map((series) => (
                  <SeriesGroup
                    key={series.id}
                    series={series}
                    champions={champions}
                    getChampionIconUrl={getChampionIconUrl}
                    updateSeriesNote={updateSeriesNote}
                    updateGamePickLane={updateGamePickLane}
                    updateGameWinner={updateGameWinner}
                    updateGameOurSide={updateGameOurSide}
                    addSeriesEvent={addSeriesEvent}
                    updateSeriesEvent={updateSeriesEvent}
                    removeSeriesEvent={removeSeriesEvent}
                    requestRemoveSeries={requestRemoveSeries}
                    renameGameTeamName={renameGameTeamName}
                    canEdit={canEdit}
                    filters={filters}
                  />
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
