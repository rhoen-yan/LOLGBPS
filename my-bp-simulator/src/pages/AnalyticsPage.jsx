import { useEffect, useMemo, useState } from 'react';
import { useChampionRoster } from '../hooks/useChampionRoster';
import { getLaneById } from '../constants/lanes';
import {
  collectDateOptions,
  collectGameContexts,
  collectOurSideContexts,
  collectOpponentTeamOptions,
  collectTeamNameOptions,
  computeFullAnalytics,
  formatDelta,
  formatRate,
  getCurrentTeamNames,
} from '../utils/analytics';
import { loadPersistedRecord } from '../utils/recordApi';

const TABS = [
  { id: 'overview', label: '總覽' },
  { id: 'our', label: '我方' },
  { id: 'enemy', label: '對手' },
  { id: 'team', label: '隊伍' },
];

const trendClass = {
  high: 'bg-emerald-900/60 text-emerald-400',
  low: 'bg-rose-900/60 text-rose-400',
  neutral: 'bg-gray-700/80 text-gray-400',
};

const trendLabel = { high: '較高', low: '較低', neutral: '持平' };

function ChampIcon({ id, name, getChampionIconUrl, size = 'w-8 h-8' }) {
  return (
    <img
      src={getChampionIconUrl(id)}
      alt={name}
      className={`${size} rounded object-cover border border-gray-700 shrink-0`}
      onError={(e) => {
        e.currentTarget.src = 'https://placehold.co/32x32/333/fff?text=?';
      }}
    />
  );
}

function LaneIcon({ laneId, size = 'w-4 h-4' }) {
  const lane = getLaneById(laneId);
  if (!lane) return null;
  return <img src={lane.icon} alt={lane.label} className={`${size} object-contain shrink-0`} />;
}

function StatRow({ row, champions, getChampionIconUrl, showBan, showWin = true, showPick = true }) {
  const champ = champions.find((c) => c.id === row.id);
  const name = champ?.name || row.id;

  return (
    <tr className="border-t border-gray-800/80">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2 min-w-0">
          <ChampIcon id={row.id} name={name} getChampionIconUrl={getChampionIconUrl} />
          <span className="text-sm truncate">{name}</span>
        </div>
      </td>
      {showPick && (
        <td className="py-2 px-2 text-sm tabular-nums text-right text-gray-300">{formatRate(row.pickRate)}</td>
      )}
      {showWin && (
        <td className="py-2 px-2 text-sm tabular-nums text-right text-gray-300">{formatRate(row.winRate)}</td>
      )}
      {showBan && (
        <td className="py-2 pl-2 text-sm tabular-nums text-right text-gray-300">{formatRate(row.banRate)}</td>
      )}
    </tr>
  );
}

function ChampLaneRow({ row, champions, getChampionIconUrl }) {
  const champ = champions.find((c) => c.id === row.id);
  const name = champ?.name || row.id;
  const lane = getLaneById(row.lane);

  return (
    <tr className="border-t border-gray-800/80">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2 min-w-0">
          <ChampIcon id={row.id} name={name} getChampionIconUrl={getChampionIconUrl} />
          <span className="text-sm truncate">{name}</span>
        </div>
      </td>
      <td className="py-2 px-2 text-right">
        {lane ? <LaneIcon laneId={row.lane} size="w-5 h-5" /> : '—'}
      </td>
      <td className="py-2 px-2 text-sm tabular-nums text-right text-gray-300">{row.picks}</td>
      <td className="py-2 px-2 text-sm tabular-nums text-right text-gray-300">{formatRate(row.pickRate)}</td>
      <td className="py-2 pl-2 text-sm tabular-nums text-right text-gray-300">{formatRate(row.winRate)}</td>
    </tr>
  );
}

function MatchupRow({ row, champions, getChampionIconUrl, showLane = false }) {
  const champ = champions.find((c) => c.id === row.id);
  const name = champ?.name || row.id;

  return (
    <tr className="border-t border-gray-800/80">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2 min-w-0">
          <ChampIcon id={row.id} name={name} getChampionIconUrl={getChampionIconUrl} />
          <span className="text-sm truncate">{name}</span>
          {showLane && row.lane && <LaneIcon laneId={row.lane} />}
        </div>
      </td>
      <td className="py-2 px-2 text-sm tabular-nums text-right text-gray-400">{row.games}</td>
      <td className="py-2 px-2 text-sm tabular-nums text-right text-gray-300">{formatRate(row.encounterRate)}</td>
      <td className="py-2 px-2 text-sm tabular-nums text-right text-gray-300">{formatRate(row.winRate)}</td>
      <td
        className={`py-2 px-2 text-sm tabular-nums text-right ${
          row.delta > 0 ? 'text-emerald-400' : row.delta < 0 ? 'text-rose-400' : 'text-gray-400'
        }`}
      >
        {formatDelta(row.delta)}
      </td>
      <td className="py-2 pl-2 text-right">
        {row.trend ? (
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${trendClass[row.trend]}`}>
            {trendLabel[row.trend]}
          </span>
        ) : (
          <span className="text-xs text-gray-600">—</span>
        )}
      </td>
    </tr>
  );
}

function RoleBlock({ role, champions, getChampionIconUrl, showWin = true }) {
  if (!role.champions.length) return null;
  return (
    <div className="analytics-role-block rounded-lg border border-gray-700/80 bg-gray-900/40 p-4">
      <h3 className="text-sm font-semibold text-gray-200 mb-3">{role.label}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[200px]">
          <thead>
            <tr className="text-[10px] text-gray-500 uppercase tracking-wide">
              <th className="pb-2 text-left font-medium">英雄</th>
              <th className="pb-2 text-right font-medium">出場率</th>
              {showWin && <th className="pb-2 text-right font-medium">勝率</th>}
            </tr>
          </thead>
          <tbody>
            {role.champions.map((row) => (
              <StatRow
                key={row.id}
                row={row}
                champions={champions}
                getChampionIconUrl={getChampionIconUrl}
                showBan={false}
                showWin={showWin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataTable({ headers, children, minWidth = '480px' }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/80">
      <table className={`w-full min-w-[${minWidth}]`} style={{ minWidth }}>
        <thead className="bg-gray-900/60">
          <tr className="text-[10px] text-gray-500 uppercase tracking-wide">{headers}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function MatchupTable({ title, meta, rows, champions, getChampionIconUrl, showLane = false }) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500 text-center py-4">尚無資料</p>;
  }
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</h4>
        <span className="text-xs text-gray-500">
          基準 {formatRate(meta.baselineWinRate)} · {meta.totalGames} 局
        </span>
      </div>
      <DataTable
        minWidth={showLane ? '600px' : '560px'}
        headers={
          <>
            <th className="py-2.5 px-3 text-left font-medium">{showLane ? '對手' : '英雄'}</th>
            <th className="py-2.5 px-2 text-right font-medium">局數</th>
            <th className="py-2.5 px-2 text-right font-medium">遭遇率</th>
            <th className="py-2.5 px-2 text-right font-medium">我方勝率</th>
            <th className="py-2.5 px-2 text-right font-medium">與基準差</th>
            <th className="py-2.5 px-3 text-right font-medium">趨勢</th>
          </>
        }
      >
        {rows.map((row) => (
          <MatchupRow
            key={row.key ?? row.id}
            row={row}
            champions={champions}
            getChampionIconUrl={getChampionIconUrl}
            showLane={showLane}
          />
        ))}
      </DataTable>
    </div>
  );
}

function OverviewCards({ overview }) {
  const cards = [
    { label: '我方局數', value: overview.totalOurGames },
    { label: '納入分析', value: overview.analyzedGames },
    { label: '路線未標', value: overview.excludedLaneGames },
    { label: '勝', value: overview.wins, accent: 'text-emerald-400' },
    { label: '敗', value: overview.losses, accent: 'text-rose-400' },
    { label: '勝率', value: formatRate(overview.winRate) },
    { label: '對手數', value: overview.opponentCount },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-gray-700/80 bg-gray-900/40 px-3 py-2.5">
          <p className="text-[10px] text-gray-500 mb-1">{card.label}</p>
          <p className={`text-lg font-semibold tabular-nums ${card.accent ?? 'text-gray-100'}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function LanePresenceBar({ rows }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {rows.map((row) => {
        const lane = getLaneById(row.laneId);
        return (
          <div key={row.laneId} className="rounded-lg border border-gray-700/80 bg-gray-900/40 p-3 text-center">
            {lane && <img src={lane.icon} alt={row.label} className="w-6 h-6 mx-auto mb-1 object-contain" />}
            <p className="text-xs text-gray-400 mb-1">{row.label}</p>
            <p className="text-sm font-semibold tabular-nums text-gray-200">{formatRate(row.pickRate)}</p>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsFilters({ filters, setFilters, dateOptions, opponentOptions }) {
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-gray-800/40 border border-gray-700/60">
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        日期
        <select
          className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[9rem]"
          value={filters.dateFilter}
          onChange={(e) => setFilters((f) => ({ ...f, dateFilter: e.target.value }))}
        >
          <option value="">全部</option>
          {dateOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        對手
        <select
          className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[9rem]"
          value={filters.teamFilter}
          onChange={(e) => setFilters((f) => ({ ...f, teamFilter: e.target.value }))}
        >
          <option value="">全部</option>
          {opponentOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        勝敗
        <select
          className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[7rem]"
          value={filters.resultFilter}
          onChange={(e) => setFilters((f) => ({ ...f, resultFilter: e.target.value }))}
        >
          <option value="all">全部</option>
          <option value="win">勝</option>
          <option value="loss">敗</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-gray-400">
        方位
        <select
          className="bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 min-w-[7rem]"
          value={filters.sideFilter}
          onChange={(e) => setFilters((f) => ({ ...f, sideFilter: e.target.value }))}
        >
          <option value="all">全部</option>
          <option value="Blue">藍方</option>
          <option value="Red">紅方</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-gray-400 pb-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-yellow-500"
          checked={filters.laneCompleteOnly}
          onChange={(e) => setFilters((f) => ({ ...f, laneCompleteOnly: e.target.checked }))}
        />
        僅路線完整局
      </label>
    </div>
  );
}

function EnemyOpponentGroup({ group, champions, getChampionIconUrl, defaultOpen = false }) {
  const { teamName, summary } = group;

  return (
    <details
      className="rounded-lg border border-gray-700/80 bg-gray-900/40"
      open={defaultOpen}
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-gray-200 hover:bg-gray-800/50 rounded-lg">
        <span className="text-red-400">{teamName}</span>
        <span className="text-gray-500 mx-2">·</span>
        <span className="tabular-nums text-gray-400">{summary.totalGames} 局</span>
        <span className="text-gray-500 mx-2">·</span>
        <span className="text-emerald-400 tabular-nums">W {summary.wins}</span>
        <span className="text-gray-500 mx-1">/</span>
        <span className="text-rose-400 tabular-nums">L {summary.losses}</span>
        <span className="text-gray-500 mx-2">·</span>
        <span className="tabular-nums text-gray-300">{formatRate(summary.winRate)}</span>
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-6">
        <LanePresenceBar rows={group.enemyLanePresence} />

        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">英雄 · 出場率 · BAN 率</h4>
          <DataTable
            headers={
              <>
                <th className="py-2.5 px-3 text-left font-medium">英雄</th>
                <th className="py-2.5 px-2 text-right font-medium">出場率</th>
                <th className="py-2.5 px-3 text-right font-medium">BAN 率</th>
              </>
            }
          >
            {group.enemy.champions.map((row) => (
              <StatRow
                key={row.id}
                row={row}
                champions={champions}
                getChampionIconUrl={getChampionIconUrl}
                showBan
                showWin={false}
              />
            ))}
          </DataTable>
        </div>

        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">位線 · 英雄</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.enemy.roles.map((role) => (
              <RoleBlock
                key={role.laneId}
                role={role}
                champions={champions}
                getChampionIconUrl={getChampionIconUrl}
                showWin={false}
              />
            ))}
          </div>
        </div>

        <MatchupTable
          title="Pick · 我方勝率"
          meta={group.matchupPick}
          rows={group.matchupPick.matchups}
          champions={champions}
          getChampionIconUrl={getChampionIconUrl}
        />

        <MatchupTable
          title="Pick @ 路線 · 我方勝率"
          meta={group.matchupEnemyLane}
          rows={group.matchupEnemyLane.matchups}
          champions={champions}
          getChampionIconUrl={getChampionIconUrl}
          showLane
        />

        <MatchupTable
          title="BAN · 我方勝率"
          meta={group.enemyBan}
          rows={group.enemyBan.matchups}
          champions={champions}
          getChampionIconUrl={getChampionIconUrl}
        />
      </div>
    </details>
  );
}

export default function AnalyticsPage() {
  const { champions, status, errorMessage, load, getChampionIconUrl } = useChampionRoster();
  const [tab, setTab] = useState('overview');
  const [analyzeTeam, setAnalyzeTeam] = useState('');
  const [filters, setFilters] = useState({
    dateFilter: '',
    teamFilter: '',
    resultFilter: 'all',
    sideFilter: 'all',
    laneCompleteOnly: true,
  });

  const [record, setRecord] = useState(null);
  const [recordLoading, setRecordLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPersistedRecord()
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .finally(() => {
        if (!cancelled) setRecordLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordData = useMemo(() => {
    const contexts = collectGameContexts(
      record?.archivedSeries ?? [],
      record?.current?.seriesHistory ?? [],
      getCurrentTeamNames(record?.teamNames),
      record?.current?.startDate ?? null,
    );
    const ourContexts = collectOurSideContexts(contexts);
    return {
      contexts,
      ourContexts,
      opponentOptions: collectOpponentTeamOptions(ourContexts),
      teamOptions: collectTeamNameOptions(contexts),
      dateOptions: collectDateOptions(contexts),
    };
  }, [record]);

  const analyticsFilters = useMemo(
    () => ({
      dateFilter: filters.dateFilter,
      teamFilter: filters.teamFilter,
      resultFilter: filters.resultFilter,
      sideFilter: filters.sideFilter === 'all' ? undefined : filters.sideFilter,
      laneCompleteOnly: filters.laneCompleteOnly,
    }),
    [filters],
  );

  const data = useMemo(
    () => computeFullAnalytics(recordData.ourContexts, recordData.contexts, analyticsFilters, analyzeTeam),
    [recordData, analyticsFilters, analyzeTeam],
  );

  const hasOurData = data.our.totalGames > 0;
  const hasAnyData = recordData.contexts.length > 0;
  const hasOurMarked = recordData.ourContexts.length > 0;

  if (recordLoading) {
    return (
      <section className="panel p-6">
        <p className="text-sm text-gray-500 text-center py-12">載入紀錄中…</p>
      </section>
    );
  }

  return (
    <section className="panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold">分析</h2>
        <div className="flex gap-1 p-1 rounded-lg bg-gray-900/60 border border-gray-700/80">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={[
                'px-3 py-1.5 rounded-md text-sm font-medium transition',
                tab === t.id
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'text-gray-400 hover:text-gray-200',
              ].join(' ')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {hasAnyData && (
        <div className="mb-6">
          <AnalyticsFilters
            filters={filters}
            setFilters={setFilters}
            dateOptions={recordData.dateOptions}
            opponentOptions={recordData.opponentOptions}
          />
        </div>
      )}

      {status === 'loading' && <p className="text-sm text-gray-500 py-8 text-center">載入中…</p>}

      {status === 'error' && (
        <div className="text-center py-8 space-y-3">
          <p className="text-red-400 text-sm">載入失敗：{errorMessage}</p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-yellow-500 text-gray-900 text-sm font-semibold"
            onClick={load}
          >
            重試
          </button>
        </div>
      )}

      {status === 'success' && !hasAnyData && (
        <p className="text-sm text-gray-500 py-12 text-center">尚無對局紀錄</p>
      )}

      {status === 'success' && hasAnyData && !hasOurMarked && (
        <p className="text-sm text-gray-500 py-12 text-center">尚無標記我方的對局</p>
      )}

      {status === 'success' && hasOurMarked && (
        <div className="space-y-8">
          {tab === 'overview' && (
            <>
              <OverviewCards overview={data.overview} />
              {hasOurData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">我方路線分布</h4>
                    <LanePresenceBar rows={data.ourLanePresence} />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">對手路線分布</h4>
                    <LanePresenceBar rows={data.enemyLanePresence} />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'our' && hasOurData && (
            <>
              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">位線 · 英雄出場率 · 勝率</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.our.roles.map((role) => (
                    <RoleBlock
                      key={role.laneId}
                      role={role}
                      champions={champions}
                      getChampionIconUrl={getChampionIconUrl}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">英雄 · 出場率 · 勝率 · BAN 率</h4>
                <DataTable
                  headers={
                    <>
                      <th className="py-2.5 px-3 text-left font-medium">英雄</th>
                      <th className="py-2.5 px-2 text-right font-medium">出場率</th>
                      <th className="py-2.5 px-2 text-right font-medium">勝率</th>
                      <th className="py-2.5 px-3 text-right font-medium">BAN 率</th>
                    </>
                  }
                >
                  {data.our.champions.map((row) => (
                    <StatRow key={row.id} row={row} champions={champions} getChampionIconUrl={getChampionIconUrl} showBan />
                  ))}
                </DataTable>
              </div>

              <div>
                <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">英雄 @ 路線</h4>
                <DataTable
                  minWidth="520px"
                  headers={
                    <>
                      <th className="py-2.5 px-3 text-left font-medium">英雄</th>
                      <th className="py-2.5 px-2 text-right font-medium">路線</th>
                      <th className="py-2.5 px-2 text-right font-medium">次數</th>
                      <th className="py-2.5 px-2 text-right font-medium">出場率</th>
                      <th className="py-2.5 px-3 text-right font-medium">勝率</th>
                    </>
                  }
                >
                  {data.ourChampionLane.rows.map((row) => (
                    <ChampLaneRow
                      key={`${row.id}:${row.lane}`}
                      row={row}
                      champions={champions}
                      getChampionIconUrl={getChampionIconUrl}
                    />
                  ))}
                </DataTable>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(['Blue', 'Red']).map((side) => {
                  const split = data.ourSplit[side];
                  if (!split.totalGames) return null;
                  return (
                    <div key={side}>
                      <h4 className={`text-xs font-medium mb-3 uppercase tracking-wide ${side === 'Blue' ? 'text-blue-400' : 'text-red-400'}`}>
                        我方 {side === 'Blue' ? '藍方' : '紅方'} · {split.totalGames} 局
                      </h4>
                      <DataTable
                        minWidth="360px"
                        headers={
                          <>
                            <th className="py-2.5 px-3 text-left font-medium">英雄</th>
                            <th className="py-2.5 px-2 text-right font-medium">出場率</th>
                            <th className="py-2.5 px-3 text-right font-medium">勝率</th>
                          </>
                        }
                      >
                        {split.champions.slice(0, 10).map((row) => (
                          <StatRow
                            key={row.id}
                            row={row}
                            champions={champions}
                            getChampionIconUrl={getChampionIconUrl}
                            showBan={false}
                          />
                        ))}
                      </DataTable>
                    </div>
                  );
                })}
              </div>

              <MatchupTable
                title="我方 BAN · 該局勝率"
                meta={data.ourBan}
                rows={data.ourBan.matchups}
                champions={champions}
                getChampionIconUrl={getChampionIconUrl}
              />
            </>
          )}

          {tab === 'our' && !hasOurData && (
            <p className="text-sm text-gray-500 text-center py-8">目前篩選下無可分析對局</p>
          )}

          {tab === 'enemy' && hasOurData && (
            <div className="space-y-4">
              {data.enemyGrouped.length > 1 && !filters.teamFilter && (
                <details className="rounded-lg border border-gray-600/60 bg-gray-900/20">
                  <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hover:text-gray-400">
                    全部對手合計 · {data.enemy.totalGames} 局
                  </summary>
                  <div className="px-4 pb-4 space-y-6">
                    <LanePresenceBar rows={data.enemyLanePresence} />
                    <MatchupTable
                      title="Pick · 我方勝率"
                      meta={data.matchupPick}
                      rows={data.matchupPick.matchups}
                      champions={champions}
                      getChampionIconUrl={getChampionIconUrl}
                    />
                  </div>
                </details>
              )}
              {data.enemyGrouped.map((group, index) => (
                <EnemyOpponentGroup
                  key={group.teamName}
                  group={group}
                  champions={champions}
                  getChampionIconUrl={getChampionIconUrl}
                  defaultOpen={data.enemyGrouped.length === 1 || index === 0}
                />
              ))}
            </div>
          )}

          {tab === 'enemy' && (!hasOurData || !data.enemyGrouped.length) && (
            <p className="text-sm text-gray-500 text-center py-8">目前篩選下無可分析對局</p>
          )}

          {tab === 'team' && (
            <>
              <div className="mb-4">
                <select
                  value={analyzeTeam}
                  onChange={(e) => setAnalyzeTeam(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:border-yellow-500 min-w-[160px]"
                >
                  <option value="">選擇隊伍</option>
                  {recordData.teamOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              {!analyzeTeam && (
                <p className="text-sm text-gray-500 text-center py-8">請選擇要分析的隊伍</p>
              )}
              {analyzeTeam && data.team?.totalGames > 0 && (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">{analyzeTeam}</h3>
                    <span className="text-xs text-gray-500 tabular-nums">{data.team.totalGames} 局</span>
                  </div>
                  <div className="mb-6">
                    <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">位線出場率</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {data.team.roles.map((role) => (
                        <RoleBlock
                          key={role.laneId}
                          role={role}
                          champions={champions}
                          getChampionIconUrl={getChampionIconUrl}
                          showWin={false}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">英雄 · 出場率 · BAN 率</h4>
                    <DataTable
                      minWidth="360px"
                      headers={
                        <>
                          <th className="py-2.5 px-3 text-left font-medium">英雄</th>
                          <th className="py-2.5 px-2 text-right font-medium">出場率</th>
                          <th className="py-2.5 px-3 text-right font-medium">BAN 率</th>
                        </>
                      }
                    >
                      {data.team.champions.map((row) => (
                        <StatRow
                          key={row.id}
                          row={row}
                          champions={champions}
                          getChampionIconUrl={getChampionIconUrl}
                          showBan
                          showWin={false}
                        />
                      ))}
                    </DataTable>
                  </div>
                </>
              )}
              {analyzeTeam && !data.team?.totalGames && (
                <p className="text-sm text-gray-500 text-center py-8">此隊伍在篩選下無路線完整對局</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
